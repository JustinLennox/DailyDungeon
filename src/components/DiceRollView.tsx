import { Devvit, useAsync, useState, Comment } from '@devvit/public-api';
import { ExpireTime, StringDictionary } from '../utils/utils.js';
import { RollDice, getDiceRollTotalKey } from '../api/RollDice.js';

export const DiceRollView = (context: Devvit.Context, gameData: any, setShowDiceView: any): JSX.Element => {

	const {
		data: userRoll,
		loading: loadingUserRoll,
		error: userRollError,
	} = useAsync(
		async () => {
			try {
				return await RollDice({ context: context, gameData: gameData, fromComments: false });
			} catch (err) {
				console.error(`Error rolling dice: ${err}`);
				context.ui.showToast("Something went wrong rolling the dice.");
				return null;
			}
		}, { depends: [gameData?.postID] }
	);

	// Fetch dice roll totals from Redis
	const {
		data: topRolls,
		loading: loadingRollTotals,
		error: rollTotalsError,
	} = useAsync(
		async () => {
			if (!gameData || !gameData.postID) return null;
			const rollTotals = (await context.redis.hGetAll(getDiceRollTotalKey(gameData))) ?? {};

			// Find the top roll
			let topRoll = '';
			let topCount = -Infinity;

			for (const [roll, countString] of Object.entries(rollTotals)) {
				const count = parseInt(countString);
				if (typeof count === 'number' && !Number.isNaN(count) && count > topCount) {
					topRoll = roll;
					topCount = count;
				}
			}

			// Handle the case where no rolls are found
			if (topRoll === '') return null;

			return { topRoll: topRoll, topCount: topCount };

		}, { depends: [gameData?.postID, userRoll] }
	);

	return (
		<vstack alignment='center middle' height={100} width={100} padding="medium" >
			<vstack 
			backgroundColor='neutral-background' 
			padding="medium" 
			cornerRadius="medium" 
			gap="medium" 
			width={80}
			alignment="center">
				<hstack alignment='center middle' width={100}>
					<button
						size='small'
						icon="close-fill"
						onPress={async () => { setShowDiceView(false) }}
					/>
					<spacer grow />
					<text wrap style='heading'>
						{!loadingUserRoll && !userRollError && userRoll ? `Your daily roll: ${userRoll}!` : "Rolling…"}
					</text>
					<spacer grow />
					<spacer width={'20px'} />
				</hstack>
				{!userRollError &&
					<image
						url={"D20-loop-all.gif"}
						imageWidth={250}
						imageHeight={250}
						description="Rolling Die"
					/>
				}
				<text wrap 
				alignment='center middle'
				width={100}
				>
					Your roll is linked to your comments. If your comment is chosen, a higher roll leads to better outcomes for your action! You can only roll once per day.
					</text>
				{/* Display dice roll totals */}
				{topRolls &&
					<hstack>
						<text wrap>{`Today's Top Roll: ${topRolls.topRoll} (${topRolls.topCount} users)`}</text>
					</hstack>
				}
			</vstack>
		</vstack>
	)
}