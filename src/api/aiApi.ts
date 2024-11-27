import { Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient, useForm } from '@devvit/public-api';
import { CreatePreview } from '../components/Preview.js';

const aiUpdate = async (
	context: Devvit.Context | JobContext,
	gameData: any
) => {
	// Check if the game has ended
	if (gameData.ended ?? false) {
		console.log('Game has ended');
		return;
	}

	// Get the last item in contentArray
	const contentArray: any[] = gameData.contentArray || [];
	if (contentArray.length === 0) {
		console.log('Content array is empty');
		return;
	}
	const redis = context.redis;
	const lastItem: any = contentArray[contentArray.length - 1];
	const postCreatedAt: Date = lastItem.postCreatedAt ? new Date(lastItem.postCreatedAt) : new Date();
	const refreshInterval: number = lastItem.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;

	// Calculate the time when we should refresh
	const nextRefreshTime: Date = new Date(postCreatedAt.getTime() + refreshInterval);
	console.log("Next refresh: ", nextRefreshTime);
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

		}

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
			gameData: any,
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
			const newContentItem: any = {
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

