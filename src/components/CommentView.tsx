import { Devvit, useAsync, useState, Comment } from '@devvit/public-api';

export const CommentView = (context: Devvit.Context, comment: any): JSX.Element => {

	const {
		data: snooURL,
		loading: loadingSnooURL,
		error: snooURLError,
	} = useAsync(async () => {
		// try {
			if (!comment || !comment.authorName) {
				return `No comment/author name for comment: ${comment}`;
			}
			const user = await context.reddit.getUserById(comment.auhtorName);
			if (!user) {
				return "No user";
			}
			const url = await user.getSnoovatarUrl();
			if (!url) {
				return "No url";
			}
			return url ?? null;
		// } catch (e) {
		// 	return `Error: ${e}`;
		// }
	});


	// Render the component
	return (
		<vstack>
			<text>Current Top Comment</text>
			<vstack padding="medium" cornerRadius="medium" gap="medium" alignment="center" backgroundColor='secondary-background'>
				<hstack>
					{snooURL && <text>{snooURL}</text>}
					{!loadingSnooURL && snooURL && (
						<image
							url={snooURL}
							imageHeight={30}
							imageWidth={30}
						/>
					)}
					<text weight='bold'>{comment.authorName}</text>
					{/* <text> • {comment.createdAt.toLocaleDateString()} </text> */}
				</hstack>
				<text>{comment.body}</text>
			</vstack>
		</vstack>
	)
}