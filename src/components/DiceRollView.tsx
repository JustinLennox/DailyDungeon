import { Devvit, useAsync, useState, Comment } from '@devvit/public-api';

export const DiceRollView = (context: Devvit.Context, gameData: any, setShowDiceView: any): JSX.Element => {

	/// The user's roll, if they've rolled
	const [userRoll, setUserRoll] = useState<number | null>(null);

	// Fetch dice roll totals from Redis
	const {
		data: rollTotalsString,
		loading: loadingRollTotals,
		error: rollTotalsError,
	} = useAsync(
		async () => {
			if (!gameData || !gameData.postID) return '{}';
			const totalKey = `diceRollTotals:${gameData.postID}`;
			const totalsString = (await context.redis.get(totalKey)) ?? '{}';
			return totalsString;
		},
		{ depends: [gameData?.postID] }
	);

	const rollTotals = JSON.parse(rollTotalsString ?? '{}');

	// Handle dice icon click
	const handleDiceClick = async () => {
		if (!gameData || !gameData.postID) return;

		try {
			// Get user ID
			const user = await context.reddit.getCurrentUser();
			let hasRolled = false;
			const userID = user?.id ?? "anonymous";
			const userKey = `diceRoll:${gameData.postID}:${userID}`;
			if (user) {
				// Check if the user has already rolled the dice for the latest post ID
				const userRolled = await context.redis.get(userKey);
				hasRolled = userRolled ? true : false;
			} else {
				hasRolled = true;
			}

			if (hasRolled) {
				// User has already rolled
				context.ui.showToast('You have already rolled the dice for this post.');
				return;
			}

			// User has not rolled yet

			// Simulate dice roll
			const diceCount = 20;
			const diceRoll = Math.floor(Math.random() * diceCount) + 1;

			setUserRoll(diceRoll);
			// Store the user's dice roll
			await context.redis.set(userKey, 'rolled');

			// Store the dice roll in Redis
			const totalKey = `diceRollTotals:${gameData.postID}`;
			const currentTotalsString = (await context.redis.get(totalKey)) ?? '{}';
			const currentTotals = JSON.parse(currentTotalsString);

			// Increment the count for the rolled number
			currentTotals[diceRoll] = (currentTotals[diceRoll] || 0) + 1;

			// Save back to Redis
			await context.redis.set(totalKey, JSON.stringify(currentTotals));

			// Update roll totals
			rollTotals[diceRoll] = currentTotals[diceRoll];
		} catch (error) {
			console.error('Error during dice roll:', error);
			context.ui.showToast('An error occurred while rolling the dice.');
		}
	};

	// Render the component
	return (
		<vstack alignment='center middle' height={100}>
			<vstack backgroundColor='neutral-background' padding="medium" cornerRadius="medium" gap="medium" alignment="center">
				{userRoll ? (
					<>
						{/* Display dice roll totals */}
						{Object.keys(rollTotals).length > 0 && (
							<vstack padding="medium" cornerRadius="medium" gap="medium" alignment="center">
								<text style="heading" size="medium">
									Dice Roll Totals
								</text>
								{Object.entries(rollTotals).map(([roll, count]) => (
									<text key={roll}>{`Rolled ${roll}: ${count} times`}</text>
								))}
							</vstack>
						)}
					</>
				) : (
					<image
						url="D20-loop-all.gif"
						imageWidth={250}
						imageHeight={250}
						description="Generative artwork: Fuzzy Fingers"
					/>
				)}
				<button onPress={() => { setShowDiceView(false) }}>Done</button>
			</vstack>
		</vstack>
	)
}