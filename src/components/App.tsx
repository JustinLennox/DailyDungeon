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
    data: allGamesData,
    loading: loadingAllGamesData,
    error: allGamesDataError,
  } = useAsync(async () => {
    try {
      const allGamesDataString = await context.redis.get('game');
      console.log("String: ", allGamesDataString);
      return allGamesDataString ? JSON.parse(allGamesDataString) : null;
    } catch (e) {
      console.error("Failed to load game data");
      throw e;
    }
  });

  // Parse game data and get the latest message
  const postNumber = (allGamesData && allGamesData.posts && context.postId) ? allGamesData.posts[context.postId] : null;
  const gameData = (postNumber != null && allGamesData && allGamesData.contentArray)
    ? allGamesData.contentArray[postNumber]
    : null;
  console.log("Client reloaded with id, post number, gameData text: ", context.postId, postNumber, gameData);


  // // Fetch top Reddit comment
  // const {
  //   data: topCommentJSON,
  //   loading: loadingTopComment,
  //   error: topCommentError,
  // } = useAsync(
  //   async () => {
  //     console.log("Fetching top comment");
  //     return null;
  //     // console.log("fetching top comment for ", context.postId);
  //     // if (!context.postId && !gameData.topComment) { return null };
  //     // const postID = context.postId;

  //     // // if (!latestMessage || !latestMessage.postID) return null;
  //     // // const postID = latestMessage.postID;

  //     // console.log("loaded top comment: ", topComment.body);
  //     // const editedComment = { ...topComment, dateString: getRelativeTime(topComment.createdAt) };
  //     // return JSON.stringify(editedComment);
  //   },
  //   { depends: [gameData?.postID] }
  // );

  const castVoteButtonPressed = async () => {
    try {
      const redditPostID = context.postId;
      if (redditPostID) {
        const post = await context.reddit.getPostById(redditPostID);
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
      {allGamesData && allGamesData.showBackground &&
        <vstack width={100} height={100}>
          <image
            url="BackgroundLoop.gif"
            width={100}
            height={100}
            imageWidth={640}
            imageHeight={640}
            resizeMode='cover'
          />
        </vstack>
      }
      <vstack padding="small" cornerRadius="medium" gap="small" alignment="center" width={100} height={100}>
        {TabsView(context, gameData, selectedTab, setSelectedTab)}
        {/* Loading and error states for game data */}
        {loadingAllGamesData && <text wrap>Loading game data...</text>}
        {allGamesDataError && <text wrap>Error loading game data.</text>}

        <spacer grow />

        {/* Game View */}
        {gameData && (
          <vstack padding="medium" cornerRadius="medium" gap="small" minWidth={50} backgroundColor='rgba(0,0,0,0.8)'>
            {/* {((context.dimensions?.width ?? 0) > 500) && (<hstack>
              <text wrap weight='bold' size='small' color='gray'>
                From the dungeon…
              </text>
              <spacer grow />
            </hstack>)} */}
            {/* <vstack alignment='center middle' padding='small'> */}
              <text wrap size='medium' weight='bold' alignment='center middle' color='white' width={100}>{gameData.text}</text>
            {/* </vstack> */}
          </vstack>
        )}

        {gameData && gameData.topComment && (CommentView(context, gameData.topComment))}

        <spacer grow />

        {/* HStack with button and dice icon */}
        <hstack gap="small" alignment="center bottom" width={100}>
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
