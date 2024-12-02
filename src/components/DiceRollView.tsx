import { Devvit, useAsync, useState, Comment } from '@devvit/public-api';
import { ExpireTime, StringDictionary } from '../utils/utils.js';

export const DiceRollView = (context: Devvit.Context, gameData: any, setShowDiceView: any): JSX.Element => {
	const totalKey = `rollTotals:${gameData.postID}`;

	const {
		data: userRoll,
		loading: loadingUserRoll,
		error: userRollError,
	} = useAsync(
		async () => {
			if (!gameData || !gameData.postID) {
				throw new Error("no-post-data");
			};
			if (gameData.finished) {
				throw new Error("post-finished");
			};

			try {
				// Get user ID
				const user = await context.reddit.getCurrentUser();
				const userID = user?.id ?? "anonymous";
				const postUserRollsKey = `userRolls:${gameData.postID}`;
				if (user) {
					// Check if the user has already rolled the dice for the latest post ID
					const userRolled = await context.redis.hGet(postUserRollsKey, userID);
					const roll = userRolled ? parseInt(userRolled) : NaN;
					if (userRolled && !Number.isNaN(roll)) {
						// context.ui.showToast(`You have already rolled ${roll} for this post.`);
						return roll;
					}
				} else {
					return null;
				}

				// User has not rolled yet

				// Simulate dice roll
				const diceCount = 20;
				const diceRoll = Math.floor(Math.random() * diceCount) + 1;

				// Store the user's dice roll
				const userRollIncr: StringDictionary = {};
				userRollIncr[userID] = diceRoll.toString()

				await context.redis.hSet(postUserRollsKey, userRollIncr);
				await context.redis.expire(postUserRollsKey, ExpireTime.day);

				// Save back to Redis
				await context.redis.hIncrBy(totalKey, diceRoll.toString(), 1);
				await context.redis.expire(totalKey, ExpireTime.day);

				return diceRoll;
			} catch (e) {
				console.error('Error during dice roll:', e);
				context.ui.showToast(`An error occurred rolling the dice. (${e})`);
				throw new Error('dice-error');
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
			const rollTotals = (await context.redis.hGetAll(totalKey)) ?? {};

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
		<vstack alignment='center middle' height={100}>
			<vstack backgroundColor='neutral-background' padding="medium" cornerRadius="medium" gap="medium" alignment="center">
				<hstack alignment='center middle' width={100}>
					<button
						size='small'
						icon="close-fill"
						onPress={async () => { setShowDiceView(false) }}
					/>
					<spacer grow />
					<text wrap style='heading'>
						{!loadingUserRoll && !userRollError && userRoll ? `You rolled a ${userRoll}!` : "Rolling…"}
					</text>
					<spacer grow />
					<spacer width={'20px'}/>
				</hstack>
				{!userRollError &&
					<image
						url={"D20-loop-all.gif"}
						imageWidth={250}
						imageHeight={250}
						description="Rolling Die"
					/>
				}
				{/* Display dice roll totals */}
				{(userRollError || userRoll) && topRolls &&
					<hstack>
						<text wrap>{`Today's Top Roll: ${topRolls.topRoll} (${topRolls.topCount} users)`}</text>
					</hstack>
				}
			</vstack>
		</vstack>
	)
}