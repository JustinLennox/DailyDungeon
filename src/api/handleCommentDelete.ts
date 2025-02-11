import { baseURL } from "../utils/Constants.js";

export async function handleCommentDelete(
	commentID: string,
	subreddit: string,
): Promise<void> {
	try {
		// Grab the post from the new "CommentToPostMap"
		const mapURL = `${baseURL}/Subreddits/${subreddit}/CommentToPostMap/${commentID}.json`;
		const mapRes = await fetch(mapURL, { method: 'GET' });
		if (!mapRes.ok) {
			console.log(`No comment->post map found for comment ${commentID} in subreddit ${subreddit}`);
			return; // If there’s no mapping, nothing to do.
		}

		const mapData = await mapRes.json();
		if (!mapData || !mapData.postID) {
			console.log(`Map data empty or missing postID for comment ${commentID}`);
			return;
		}

		// 2) We know which post it belongs to
		const mappedPostID = mapData.postID;
		console.log(`Comment ${commentID} maps to post ${mappedPostID}`);

		// 3) Check if it’s stored as the top comment for that post
		const topCommentKey = `${baseURL}/Subreddits/${subreddit}/TopComments/${mappedPostID}.json`;
		const topCommentRes = await fetch(topCommentKey, { method: 'GET' });
		if (topCommentRes.ok) {
			const topCommentData = await topCommentRes.json();
			// Usually something like { comment: { id: 't1_XXXX', ...}, postID: '...', subredditName: '...' }
			if (topCommentData?.comment?.id === commentID) {
				// Remove the top comment entry entirely (or patch out just the comment)
				await fetch(topCommentKey, { method: 'DELETE' });
				console.log(`Deleted top comment for post ${mappedPostID} in subreddit ${subreddit}`);
			}
		}

		// 4) Delete the map entry (so we don’t leave stale references)
		await fetch(mapURL, { method: 'DELETE' });
		console.log(`Removed comment->post map entry for comment ${commentID}`);
	} catch (err) {
		console.error(`Failed to handle comment delete for ${commentID}: ${err}`);
	}
}