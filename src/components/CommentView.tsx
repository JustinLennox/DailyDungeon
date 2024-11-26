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

	return (
		<vstack onPress={async () => {
			try {
				const redditComment = await context.reddit.getCommentById(comment.id);
				await context.ui.navigateTo(redditComment);
			} catch (e) {
				console.log(e);
			}
		}}>
			<vstack padding="medium" cornerRadius="medium" gap="small" backgroundColor='secondary-background'>
				<hstack>
					<vstack grow alignment='start top'>
						<image
							url={"x"}
							imageHeight={30}
							imageWidth={30}
						/>
						<spacer grow />
					</vstack>
					<vstack alignment='start top'>
						<hstack gap='small'>
							<text>{comment.authorName}</text>
							{comment.dateString && (
								<>
									<text color='secondary-plain-weak'>•</text>
									<text color='secondary-plain-weak'>{comment.dateString} ago</text>
								</>
							)}
						</hstack>
						<hstack padding='small'>
							<text color='neutral-content-strong' weight='bold'>{comment.body}</text>
						</hstack>
						<hstack gap='small' alignment='start middle'>
							<icon name="upvote-fill" color="upvote-plain" />
							<text>{comment.score}</text>
						</hstack>
					</vstack>
				</hstack>
				<hstack alignment='center middle'>
					<spacer grow />
					<text
						color='secondary-plain-weak'
					>
						Top Comment
					</text>
				</hstack>
			</vstack>
		</vstack>
	)
}