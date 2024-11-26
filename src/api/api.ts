import { Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { CreatePreview } from '../components/Preview.js';
import { a } from 'vitest/dist/suite-IbNSsUWN.js';

// const DEFAULT_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEFAULT_REFRESH_INTERVAL = 60000;

export const fetchGame = async (subredditName: string, redis: RedisClient) => {
	console.log("Fetching game for ", subredditName);
	try {
		// Construct the full URL with all query parameters
		const url = `https://gwamps-quest-default-rtdb.firebaseio.com/RedditPlaysDnD/${subredditName}.json`;
		console.log("Fetching from url: ", url);
		const response = await fetch(url, {
			method: 'get',
			headers: {
				'accept': 'application/json',
			},
		});
		if (!response.ok) {
			// Handle non-200 responses
			console.log("Fetch game info failed: ", response);
			return null;
		}
		const responseJSON = await response.json();
		console.log("Fetch info succeeded: ", responseJSON);
	} catch (e) {
		console.log("Failed to fetch game info: ", e);
	}
}

export const createPost = async (context: Devvit.Context | JobContext, ui: UIClient | undefined) => {
	try {
		const subreddit = await context.reddit.getCurrentSubreddit();

		// Firebase database URL to fetch the current game data
		const gameUrl = `https://gwamps-quest-default-rtdb.firebaseio.com/RedditPlaysDnD/${subreddit.name}/games/${subreddit.name}.json`;

		let title = `${subreddit.name} Plays DnD`;
		let currentDay = 1; // Default to Day 1 if currentDay doesn't exist
		let gameData;

		// Fetch the current game data from Firebase
		try {
			const response = await fetch(gameUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				gameData = await response.json();
				if (gameData && Object.keys(gameData).length > 0) {
					// Game exists
					console.log('Game already exists in Firebase');
					currentDay = gameData.currentDay || 1;
				} else {
					// Game data doesn't exist, will create new game
					console.log('Game data does not exist, will create new game in Firebase');
				}
			} else {
				console.error(`Failed to fetch game data: ${response.status}`);
				return;
			}
		} catch (error) {
			console.error('Error fetching game data:', error);
			throw error;
		}

		// Update the title to include the current day
		title = `${subreddit.name} Plays DnD: Day ${currentDay}`;

		// Create the Reddit post with the updated title
		const post = await context.reddit.submitPost({
			// This will show while your post is loading
			preview: CreatePreview(),
			title: title,
			subredditName: subreddit.name,
		});

		// Retrieve the post ID and createdAt
		const postID = post.id;
		const postCreatedAt = new Date().toISOString(); // Use current time if post.createdAt is not available

		// const refreshInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
		const refreshInterval = 60000; // 1 minute in milliseconds


		// Prepare the content array item
		const contentItem = {
			text: 'What is your name adventurer?',
			postID: postID,
			postCreatedAt: postCreatedAt,
			refreshInterval: refreshInterval
		};

		// If game doesn't exist, create new game data
		if (!gameData || Object.keys(gameData).length === 0) {
			const data = {
				latestPostID: postID,
				currentDay: currentDay,
				ended: false,
				contentArray: [contentItem]
			};

			// Send a PUT request to Firebase to create new game data
			await fetch(gameUrl, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});

			console.log("Successfully created new game in Firebase");
		} else {
			// Game exists, update latestPostID
			gameData.latestPostID = postID;

			// Append new contentItem to contentArray
			if (!gameData.contentArray) {
				gameData.contentArray = [];
			}
			gameData.contentArray.push(contentItem);

			// Update the game data in Firebase
			await fetch(gameUrl, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(gameData)
			});

			console.log("Successfully updated game in Firebase");
		}

		if (ui) {
			ui.showToast({
				text: `Successfully created your post!`,
				appearance: 'success',
			});

			ui.navigateTo(post);
		}
	} catch (e) {
		console.error("Error creating post: ", e);
		if (ui) {
			ui.showToast({
				text: `Failed to create your post: ${e}`,
				appearance: 'neutral',
			});
		}
	}
}

// Define interfaces for game data structures
interface GameData {
	ended?: boolean;
	threadId?: string;
	currentDay?: number;
	latestPostID?: string;
	contentArray?: ContentItem[];
}

interface ContentItem {
	text?: string;
	postID?: string;
	postCreatedAt?: string;
	refreshInterval?: number;
}

export const updateGame = async (
	redis: RedisClient,
	subredditName: string,
	context: Devvit.Context | JobContext
): Promise<void> => {
	// Firebase database URL
	const gameUrl: string = `https://gwamps-quest-default-rtdb.firebaseio.com/RedditPlaysDnD/${subredditName}/games/${subredditName}.json`;
	console.log("Fetching game data from ", gameUrl);
	// Fetch the current game data from Firebase
	let gameData: GameData;
	try {
		const response: Response = await fetch(gameUrl, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		console.log("Got response: ", response);
		if (response.ok) {
			gameData = (await response.json()) as GameData;
			if (!gameData) {
				console.error("No game data found from ", (await response.json()));
				return;
			}
		} else {
			console.error(`Failed to fetch game data: ${response.status}`);
			return;
		}
	} catch (error) {
		console.error('Error fetching game data:', error);
		return;
	}

	// Set the Redis property 'game' to the game data
	await redis.set('game', JSON.stringify(gameData));

	// Check if the game has ended
	if (gameData.ended ?? false) {
		console.log('Game has ended');
		return;
	}

	// Get the last item in contentArray
	const contentArray: ContentItem[] = gameData.contentArray || [];
	if (contentArray.length === 0) {
		console.log('Content array is empty');
		return;
	}

	const lastItem: ContentItem = contentArray[contentArray.length - 1];
	const postCreatedAt: Date = lastItem.postCreatedAt ? new Date(lastItem.postCreatedAt) : new Date();
	const refreshInterval: number = lastItem.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;

	// Calculate the time when we should refresh
	const nextRefreshTime: Date = new Date(postCreatedAt.getTime() + refreshInterval);
	const now: Date = new Date();

	// Check if it's time to update
	if (nextRefreshTime <= now) {
		// Assistant status management using Redis
		const assistantStatus: string | null | undefined = await redis.get('assistant_status');

		if (assistantStatus === 'busy') {
			console.log('Assistant is currently running a job, waiting');
			return;
		}

		// Check if there's an ongoing run
		const storedRunId: string | null | undefined = await redis.get('assistant_runId');

		if (storedRunId) {
			// A run is in progress; check its status
			const runStatus: string | null = await checkRunStatus(storedRunId, redis);
			if (runStatus === 'succeeded') {
				// Retrieve the assistant's response and proceed
				const assistantResponse: string | null = await getAssistantResponse(gameData.threadId!, redis);
				if (assistantResponse) {
					await handleAssistantResponse(
						assistantResponse,
						gameData,
						gameUrl,
						subredditName,
						context,
						refreshInterval
					);
					// Clear the runId and reset assistant status
					await redis.del('assistant_runId');
					await redis.set('assistant_status', 'idle');
				} else {
					console.log('Assistant did not provide a response');
					await redis.set('assistant_status', 'idle');
				}
			} else if (runStatus === 'failed' || runStatus === 'canceled') {
				console.error(`Run ${storedRunId} has ${runStatus}`);
				// Clear the runId and reset assistant status
				await redis.del('assistant_runId');
				await redis.set('assistant_status', 'idle');
			} else {
				console.log(`Run ${storedRunId} is still in progress`);
				// Run is still in progress; exit the function
				return;
			}
		} else {
			// No run in progress; start a new run
			await redis.set('assistant_status', 'busy');

			// OpenAI Assistants API details
			const assistantId: string = 'asst_PC60VAMDg1w5w2FL53Uv9lN5'; // Replace with your assistant ID
			const apiKey: string = 'sk-svcacct-0HZuaxCRkaxXBepUCc0MuW4W0XPjtPRoTn9c_t42_3PrbClPtTn-v9gi8-erd-AHT3BlbkFJY153rxPpFsZBqpqxRLkJcWR8osQ-xsQ6ZiW45KqActod7E7fTAiB9UuvN9eFNUIA'; // Replace with your OpenAI API key
			const apiHeaders: Record<string, string> = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'OpenAI-Beta': 'assistants=v2',
			};

			// Get the thread ID from game data or create a new thread
			let threadId: string | undefined = gameData.threadId;
			if (!threadId) {
				// Create a new thread
				try {
					const threadResponse: Response = await fetch('https://api.openai.com/v1/threads', {
						method: 'POST',
						headers: apiHeaders,
						body: JSON.stringify({}),
					});

					if (threadResponse.ok) {
						const threadData = await threadResponse.json();
						threadId = threadData.id;

						// Save the thread ID to game data
						gameData.threadId = threadId;

						// Update game data in Firebase
						await fetch(gameUrl, {
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(gameData),
						});

						console.log('Created new thread with ID:', threadId);
					} else {
						console.error(`Failed to create thread: ${threadResponse.status} ${threadResponse.statusText}`);
						await redis.set('assistant_status', 'idle');
						return;
					}
				} catch (error) {
					console.error('Error creating thread:', error);
					await redis.set('assistant_status', 'idle');
					return;
				}
			}

			// Get the top comment from the last Reddit post
			if (!lastItem.postID) {
				console.error("No post id for last item");
				return;
			}
			const postID: string = lastItem.postID;
			try {
				// Fetch the comments
				const comments = await context.reddit.getComments({ postId: postID, limit: 1, sort: 'top' });
				console.log("Fetched comments: ", comments);
				const allComments = await comments.all();
				console.log("All comments: ", allComments);

				if (allComments.length <= 0) {
					console.log('No comments for post id ', postID);
					await redis.set('assistant_status', 'idle');
					return;
				}

				const topComment = allComments[0];
				if (!topComment) {
					console.log('No comments on the post');
					await redis.set('assistant_status', 'idle');
					return;
				}

				const userInput: string = topComment.body;

				// Create a new message in the thread with the top comment
				const messageUrl: string = `https://api.openai.com/v1/threads/${threadId}/messages`;
				const messageBody = {
					role: 'user',
					content: userInput,
				};

				const messageResponse: Response = await fetch(messageUrl, {
					method: 'POST',
					headers: apiHeaders,
					body: JSON.stringify(messageBody),
				});

				if (!messageResponse.ok) {
					console.error(`Failed to create message: ${messageResponse.status} ${messageResponse.statusText}`);
					await redis.set('assistant_status', 'idle');
					return;
				}

				// Create a run to get the assistant's response
				const runUrl: string = `https://api.openai.com/v1/threads/${threadId}/runs`;
				const runBody = {
					assistant_id: assistantId,
				};

				const runResponse: Response = await fetch(runUrl, {
					method: 'POST',
					headers: apiHeaders,
					body: JSON.stringify(runBody),
				});

				if (!runResponse.ok) {
					console.error(`Failed to create run: ${runResponse.status} ${runResponse.statusText}`);
					await redis.set('assistant_status', 'idle');
					return;
				}

				const runData = await runResponse.json();
				const runId: string = runData.id;

				// Store the runId in Redis
				await redis.set('assistant_runId', runId);

				console.log(`Started run with ID: ${runId}`);

				// Exit the function; the next call will check the run status
				return;
			} catch (error) {
				console.error('Error during assistant interaction:', error);
				await redis.set('assistant_status', 'idle');
				return;
			}
		}
	} else {
		console.log('Not time to refresh yet');
	}
};

// Helper function to check the status of a run
const checkRunStatus = async (runId: string, redis: RedisClient): Promise<string | null> => {
	const apiKey: string = 'YOUR_OPENAI_API_KEY'; // Replace with your OpenAI API key
	const apiHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${apiKey}`,
		'OpenAI-Beta': 'assistants=v2',
	};

	try {
		// Get the run status
		const runStatusResponse: Response = await fetch(`https://api.openai.com/v1/runs/${runId}`, {
			method: 'GET',
			headers: apiHeaders,
		});

		if (!runStatusResponse.ok) {
			console.error(`Failed to get run status: ${runStatusResponse.status} ${runStatusResponse.statusText}`);
			await redis.set('assistant_status', 'idle');
			return null;
		}

		const runStatusData = await runStatusResponse.json();
		return runStatusData.status as string;
	} catch (error) {
		console.error('Error checking run status:', error);
		await redis.set('assistant_status', 'idle');
		return null;
	}
};

// Helper function to retrieve the assistant's response
const getAssistantResponse = async (threadId: string, redis: RedisClient): Promise<string | null> => {
	const apiKey: string = 'YOUR_OPENAI_API_KEY'; // Replace with your OpenAI API key
	const apiHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${apiKey}`,
		'OpenAI-Beta': 'assistants=v2',
	};

	try {
		// Get the messages in the thread
		const messagesResponse: Response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
			method: 'GET',
			headers: apiHeaders,
		});

		if (!messagesResponse.ok) {
			console.error(`Failed to list messages: ${messagesResponse.status} ${messagesResponse.statusText}`);
			return null;
		}

		const messagesData = await messagesResponse.json();
		const messages = messagesData.data;

		// Find the last assistant message
		const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
		if (assistantMessages.length > 0) {
			const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
			return lastAssistantMessage.content as string;
		} else {
			console.log('No assistant messages found');
			return null;
		}
	} catch (error) {
		console.error('Error retrieving assistant response:', error);
		return null;
	}
};

// Helper function to handle the assistant's response
const handleAssistantResponse = async (
	assistantResponse: string,
	gameData: GameData,
	gameUrl: string,
	subredditName: string,
	context: Devvit.Context | JobContext,
	refreshInterval: number
): Promise<void> => {
	// Create a new Reddit post with the assistant's response
	const newPostTitle: string = `${subredditName} Plays DnD: Day ${gameData.currentDay ?? 0 + 1}`;
	const newPost = await context.reddit.submitPost({
		title: newPostTitle,
		preview: CreatePreview(),
		subredditName: subredditName,
	});

	// Prepare the new content item
	const newContentItem: ContentItem = {
		text: assistantResponse,
		postID: newPost.id,
		postCreatedAt: new Date().toISOString(),
		refreshInterval: refreshInterval,
	};

	// Update the game data
	gameData.currentDay = (gameData.currentDay ?? 0) + 1;
	gameData.latestPostID = newPost.id;
	gameData.contentArray = gameData.contentArray ?? [];
	gameData.contentArray.push(newContentItem);

	// Update the game data in Firebase
	await fetch(gameUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(gameData),
	});

	console.log('Created new post and updated game data in Firebase');
};

