import { Devvit, useAsync, useState, Comment, StateSetter } from '@devvit/public-api';

interface CommentViewProps {
	context: Devvit.Context;
	comment: any;
	commentExpanded: boolean;
	textExpanded: boolean;
	setCommentExpanded: StateSetter<boolean>;
	setTextExpanded: StateSetter<boolean>;
}

export const CommentView = ({
	context,
	comment,
	commentExpanded,
	textExpanded,
	setCommentExpanded,
	setTextExpanded
}: CommentViewProps): JSX.Element => {

	// const {
	// 	data: snooURL,
	// 	loading: loadingSnooURL,
	// 	error: snooURLError,
	// } = useAsync(async () => {
	// 	// try {
	// 	if (!comment || !comment.authorName) {
	// 		return `No comment/author name for comment: ${comment}`;
	// 	}
	// 	const user = await context.reddit.getUserByUsername(comment.authorName);
	// 	if (!user) {
	// 		return "No user";
	// 	}
	// 	const url = await user.getSnoovatarUrl();
	// 	if (!url) {
	// 		console.log("No snoovatar url");
	// 		return "No url";
	// 	}
	// 	console.log("Got snoovatar url: ", url);
	// 	return url ?? null;
	// 	// } catch (e) {
	// 	// 	return `Error: ${e}`;
	// 	// }
	// });

	const navigateToComment = async () => {
		try {
			const redditComment = await context.reddit.getCommentById(comment.id);
			await context.ui.navigateTo(redditComment);
		} catch (e) {
			console.log(e);
		}
	}

	return (
		<vstack padding="medium" cornerRadius="medium" gap="small" backgroundColor='secondary-background' minWidth={50}
			maxHeight={commentExpanded ? 90 : textExpanded ? 10 : 50}
		>
			<hstack gap='small' width={100}>
				<hstack width='20px' height='20px' cornerRadius='full'>
					<image
						url={"avatar_default.png"}
						imageHeight={20}
						imageWidth={20}
						resizeMode='cover'
					/>
				</hstack>
				<hstack gap='small' alignment='start middle'>
					<text wrap size='small'>{comment.authorName}</text>
					{comment.dateString && (
						<>
							<text color='secondary-plain-weak' size='small'>•</text>
							<text wrap color='secondary-plain-weak' size='small'>{comment.dateString} ago</text>
						</>
					)}
					<spacer grow />
				</hstack>
				<spacer grow />
				{comment.diceRoll && (
					<zstack width='20px' height='20px' alignment='center middle'>
						<image
							url={"D20Icon.png"}
							imageHeight={20}
							imageWidth={20}
							resizeMode='fit'
						/>
						<text size='medium'
							weight='bold'
							color={comment.diceRoll === 20 ? "darkgoldenrod" : (comment.diceRoll === 1 ? "firebrick" : "white")}
							outline='thick'
						>
							{comment.diceRoll}
						</text>
					</zstack>
				)
				}
			</hstack>
			{/* <hstack padding='small' alignment='center middle'> */}
			<text wrap color='neutral-content-strong'
				weight='bold'
				size={'medium'}
				alignment='center middle'
				overflow='ellipsis'
				width={100}
				onPress={() => { 
					setCommentExpanded(!commentExpanded) 
					setTextExpanded(commentExpanded);
				}}
			>
				{comment.body}
			</text>
			{/* </hstack> */}
			<hstack gap='small' alignment='start middle'>
				<icon name="upvote-fill" color="upvote-plain" size='small' />
				<text size='small' weight='bold'>{comment.score}</text>
				<spacer grow />
				<hstack
					onPress={async () => { await navigateToComment() }}
					gap='small'
				>
					<text color='secondary-plain-weak' size='small'>
						Top Comment
					</text>
					<icon name='comments' color='secondary-plain-weak' size='small' />
				</hstack>
			</hstack>
		</vstack>
	)
}