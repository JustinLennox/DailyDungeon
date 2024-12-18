import { Devvit, useAsync, useState, Comment, StateSetter } from '@devvit/public-api';
import { TabType } from '../utils/utils.js';

interface HowToViewProps {
	context: Devvit.Context;
	setSelectedTab: StateSetter<TabType>;
}

export const HowToView = ({
	context,
	setSelectedTab
}: HowToViewProps): JSX.Element => {

	// const navigateToComment = async () => {
	// 	try {
	// 		const redditComment = await context.reddit.getCommentById(comment.id);
	// 		await context.ui.navigateTo(redditComment);
	// 	} catch (e) {
	// 		console.log(e);
	// 	}
	// }

	return (
		<vstack
			padding="medium"
			cornerRadius="medium"
			gap="small"
			width={100}
			backgroundColor="rgba(0,0,0,0.8)"
		>
			<hstack alignment='center middle' width={100}>
				<button icon={'close'} size='small' onPress={() => { setSelectedTab(TabType.main) }} />
				<spacer grow />
				<text style='heading'>How To Play</text>
				<spacer grow />
				<spacer width={'20px'} />
			</hstack>
			<text
				wrap
				size="medium"
				weight="bold"
				alignment="center middle"
				color="white"
				width={100}
			>
				{`DailyDungeon is a shared role-playing game. Imagine the entire ${context.subredditName + " "}subreddit is playing as a single character.`}
			</text>
			<text
				wrap
				size="medium"
				weight="bold"
				alignment="center middle"
				color="white"
				width={100}
			>
				{`Every day the top voted comment from the latest post will be chosen as the main character's next action.`}
			</text>
			<text
				wrap
				size="medium"
				weight="bold"
				alignment="center middle"
				color="white"
				width={100}
			>
				{`You can roll the dice once per day. Your roll will be tied to any comments you make. The higher your roll the better your action will turn out if it's chosen!`}
			</text>
		</vstack>
	)
}