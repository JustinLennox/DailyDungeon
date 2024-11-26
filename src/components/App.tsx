import { Devvit, useAsync, useState, Comment, useInterval } from '@devvit/public-api';
import { CommentView } from './CommentView.js';
import { DiceRollView } from './DiceRollView.js';

export const App = (context: Devvit.Context): JSX.Element => {

  // State for showing the dice roll view
	const [showDiceRoller, setShowDiceRoller] = useState(false);

  // Fetch game data from Redis
  const {
    data: allGamesDataString,
    loading: loadingAllGamesData,
    error: allGamesDataError,
  } = useAsync(async () => {
    const data = await context.redis.get('game');
    return data ?? null;
  });

  // Parse game data and get the latest message
  const allGamesData = allGamesDataString ? JSON.parse(allGamesDataString) : null;
  const gameData = allGamesData?.contentArray
    ? allGamesData.contentArray[allGamesData.contentArray.length - 1]
    : null;

  // Fetch top Reddit comment
  const {
    data: topCommentJSON,
    loading: loadingTopComment,
    error: topCommentError,
  } = useAsync(
    async () => {
      console.log("Fetching top comment");
      // console.log("fetching top comment for ", context.postId);
      if (!context.postId) { return null };
      const postID = context.postId;

      // if (!latestMessage || !latestMessage.postID) return null;
      // const postID = latestMessage.postID;

      const comments = await context.reddit.getComments({
        postId: postID,
        limit: 1,
        sort: 'top',
      });
      const allComments = await comments.all();
      const topComment = allComments[0];
      console.log("loaded top comment: ", topComment);
      return topComment ? JSON.stringify(topComment) : null;
    },
    { depends: [gameData?.postID] }
  );

  const castVoteButtonPressed = async () => {
    try {
      if (gameData && gameData.postID) {
        const post = await context.reddit.getPostById(gameData.postID);
        console.log("Navigating to post: ", post.id);
        context.ui.navigateTo(post);
      }
    } catch (e) {
      console.error("Cast vote failed: ", e);
    }
  }

  // Render the component
  return (
    <zstack width={100} height={100} padding='none' gap='none' alignment='center middle'>
      <vstack padding="medium" cornerRadius="medium" gap="medium" alignment="center" width={100} height={100}>
        {/* Loading and error states for game data */}
        {loadingAllGamesData && <text>Loading game data...</text>}
        {allGamesDataError && <text>Error loading game data.</text>}

        {/* Game View */}
        {allGamesData && gameData && (
          <vstack padding="medium" cornerRadius="medium" gap="medium" alignment="center">
            <text style="heading" size="large">
              The Story Thus Far…
            </text>
            <text>{gameData.text}</text>
          </vstack>
        )}
        {!loadingTopComment && topCommentJSON && CommentView(context, JSON.parse(topCommentJSON))}

        {/* HStack with button and dice icon */}
        <hstack gap="small" alignment="center" width={100} grow>
          <button
            appearance="primary"
            grow
            onPress={() => { castVoteButtonPressed() }}
          >
            Cast your vote!
          </button>
          <button icon="random" onPress={() => { setShowDiceRoller(true) }}>Roll</button>
        </hstack>
      </vstack>

      {showDiceRoller && (
        DiceRollView(context, gameData, setShowDiceRoller)
      )}
    </zstack>
  );
};

// Register the custom post type or component
Devvit.addCustomPostType({
  name: 'RedditPlaysDnD',
  description: 'An interactive Reddit DnD game.',
  render: App,
});
