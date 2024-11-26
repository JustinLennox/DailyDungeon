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
		const user = await context.reddit.getUserByUsername(comment.authorName);
		if (!user) {
			return "No user";
		}
		const url = await user.getSnoovatarUrl();
		if (!url) {
			console.log("No snoovatar url");
			return "No url";
		}
		console.log("Got snoovatar url: ", url);
		return url ?? null;
		// } catch (e) {
		// 	return `Error: ${e}`;
		// }
	});

	const navigateToComment = async () => {
		try {
			const redditComment = await context.reddit.getCommentById(comment.id);
			await context.ui.navigateTo(redditComment);
		} catch (e) {
			console.log(e);
		}
	}

	return (
		<vstack>
			<vstack padding="medium" cornerRadius="medium" gap="small" backgroundColor='secondary-background'>
				<hstack gap='small'>
					<image
						url={"x"}
						imageHeight={30}
						imageWidth={30}
					/>
					<text>{comment.authorName}</text>
					{comment.dateString && (
						<>
							<text color='secondary-plain-weak'>•</text>
							<text color='secondary-plain-weak'>{comment.dateString} ago</text>
						</>
					)}
					<spacer grow />
				</hstack>
				<hstack padding='small' alignment='center middle'>
					<text color='neutral-content-strong'
						weight='bold'
						size={'medium'}
						alignment='center middle'
						overflow='ellipsis'
					>
						{comment.body}
					</text>
				</hstack>
				<hstack gap='small' alignment='start middle'>
					<icon name="upvote-fill" color="upvote-plain" />
					<text>{comment.score}</text>
					<spacer grow />
					<hstack
						onPress={async () => { await navigateToComment() }}
						gap='small'
					>
						<text color='secondary-plain-weak'>
							Top Comment
						</text>
						<icon name='comments' color='secondary-plain-weak' size='small' />
					</hstack>
				</hstack>
			</vstack>
		</vstack>
	)
}