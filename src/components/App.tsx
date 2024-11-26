import { Devvit, useAsync, useState, Comment, useInterval } from '@devvit/public-api';
import { CommentView } from './CommentView.js';
import { DiceRollView } from './DiceRollView.js';
import { TabsView } from './TabView.js';
import { getRelativeTime, TabType } from '../utils/utils.js';

export const App = (context: Devvit.Context): JSX.Element => {

  const [showDiceRoller, setShowDiceRoller] = useState(false);

  const [selectedTab, setSelectedTab] = useState(TabType.main);

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
      if (!topComment) {
        console.log("No top comment loaded");
        return null;
      }
      console.log("loaded top comment: ", topComment.body);
      const editedComment = { ...topComment, dateString: getRelativeTime(topComment.createdAt) };
      return JSON.stringify(editedComment);
    },
    { depends: [gameData?.postID] }
  );

  const castVoteButtonPressed = async () => {
    try {
      context.ui.showToast(`WHYYY... is there a context??: ${context}`);
      const redditPostID = context.postId;
      if (redditPostID) {
        const post = await context.reddit.getPostById(redditPostID);
        context.ui.showToast(`Navigating to post: ${redditPostID}`);
        context.ui.navigateTo(post);
      } else {
        context.ui.showToast(`No reddit post ID`);
      }
    } catch (e) {
      console.error("Cast vote failed: ", e);
      context.ui.showToast(`${e}`);
    }
  }

  // Render the component
  return (
    <zstack width={100} height={100} padding='none' gap='none' alignment='center middle'>
      <vstack padding="small" cornerRadius="medium" gap="small" alignment="center" width={100} height={100}>
        {TabsView(context, gameData, selectedTab, setSelectedTab)}
        {/* Loading and error states for game data */}
        {loadingAllGamesData && <text wrap>Loading game data...</text>}
        {allGamesDataError && <text wrap>Error loading game data.</text>}

        <spacer grow />

        {/* Game View */}
        {gameData && (
          <vstack padding="medium" cornerRadius="medium" gap="small" minWidth={50} backgroundColor='black'>
            {/* {((context.dimensions?.width ?? 0) > 500) && (<hstack>
              <text wrap weight='bold' size='small' color='gray'>
                From the dungeon…
              </text>
              <spacer grow />
            </hstack>)} */}
            <vstack alignment='center middle' padding='small'>
              <text wrap style='heading' alignment='center middle' color='white' width={100}>{gameData.text}</text>
            </vstack>
          </vstack>
        )}

        {!loadingTopComment && topCommentJSON && CommentView(context, JSON.parse(topCommentJSON))}

        <spacer grow />

        {/* HStack with button and dice icon */}
        <hstack gap="small" alignment="center" width={100} grow>
          <button
            appearance="primary"
            grow
            onPress={async () => { await castVoteButtonPressed() }}
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
