// App.tsx
import {
  Devvit,
  useAsync,
  useState,
} from "@devvit/public-api";
import { CommentView } from "./CommentView.js";
import { DiceRollView } from "./DiceRollView.js";
import { TabsView } from "./TabView.js";
import { getRelativeTime, TabType } from "../utils/utils.js";

export const App = (context: Devvit.Context): JSX.Element => {
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [selectedTab, setSelectedTab] = useState(TabType.main);

  const [textExpanded, setTextExpanded] = useState<boolean>(false);
  const [commentExpanded, setCommentExpanded] = useState<boolean>(false);

  // State for current day
  const [currentDay, setCurrentDay] = useState<number | null>(null);

  // Fetch game data from Redis using useAsync
  const {
    data: allGamesData,
    loading: loadingAllGamesData,
    error: allGamesDataError,
  } = useAsync(async () => {
    try {
      const allGamesDataString = await context.redis.get("game");
      const allGamesData = allGamesDataString ? JSON.parse(allGamesDataString) : null;
      if (allGamesData && currentDay === null) {
        const postDay =
          allGamesData.posts && context.postId
            ? allGamesData.posts[context.postId]
            : null;
        if (postDay !== null && postDay !== undefined) {
          setCurrentDay(postDay);
        } else {
          setCurrentDay(maxDay);
        }
      }
      return allGamesData;
    } catch (e) {
      console.error("Failed to load game data");
      throw e;
    }
  });

  // Determine the maximum day (currentDay from game data)
  const maxDay =
    allGamesData && typeof allGamesData.currentDay === "number"
      ? allGamesData.currentDay
      : 0;

  const postNumber = (allGamesData && allGamesData.posts && context.postId) ? allGamesData.posts[context.postId] ?? maxDay : maxDay;

  // Get the postID for the current day
  const currentPostID =
    allGamesData &&
    allGamesData.contentArray &&
    allGamesData.contentArray[currentDay ?? postNumber]?.postID;

  const gameData =
    allGamesData &&
      allGamesData.contentArray &&
      allGamesData.contentArray[currentDay ?? postNumber]
      ? allGamesData.contentArray[currentDay ?? postNumber]
      : null;

  console.log(
    "Client reloaded with currentDay, postNumber, postID, gameData text: ",
    currentDay,
    postNumber,
    currentPostID,
    gameData?.text
  );

  const castVoteButtonPressed = async () => {
    try {
      if (currentPostID) {
        const post = await context.reddit.getPostById(currentPostID);
        context.ui.navigateTo(post);
      } else {
        context.ui.showToast(`No Reddit post ID`);
      }
    } catch (e) {
      console.error("Cast vote failed: ", e);
      context.ui.showToast(`${e}`);
    }
  };

  // Render the component
  return (
    <zstack
      width={100}
      height={100}
      padding="none"
      gap="none"
      alignment="center middle"
    >
      <vstack width={100} height={100}>
        <image
          url="BackgroundLoop.gif"
          width={100}
          height={100}
          imageWidth={640}
          imageHeight={640}
          resizeMode="cover"
        />
      </vstack>
      <vstack
        padding="small"
        cornerRadius="medium"
        gap="small"
        alignment="center"
        width={100}
        height={100}
      >
        {/* Tabs View */}
        {allGamesData && (
          <TabsView
            context={context}
            game={gameData}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            currentDay={currentDay ?? postNumber}
            setCurrentDay={setCurrentDay}
            maxDay={maxDay}
          />
        )}
        {/* Loading and error states for game data */}
        {loadingAllGamesData && <text wrap>Loading game data...</text>}
        {allGamesDataError && <text wrap>Error loading game data.</text>}

        <spacer grow />

        {/* Game View */}
        {selectedTab === TabType.main && gameData && (
          <vstack
            padding="medium"
            cornerRadius="medium"
            gap="small"
            minWidth={50}
            backgroundColor="rgba(0,0,0,0.8)"
            maxHeight={textExpanded ? 90 : commentExpanded ? 10 : 50}
            onPress={() => {
              console.log("Expanding text!");
              setTextExpanded(!textExpanded);
              setCommentExpanded(textExpanded);
            }}
          >
            <text
              wrap
              size="medium"
              weight="bold"
              alignment="center middle"
              color="white"
              width={100}
            >
              {textExpanded}
              {gameData.text ?? "This dungeon is still loading..."}
            </text>
          </vstack>
        )}

        {/* Past Days or Other Tabs */}
        {selectedTab !== TabType.main && (
          <vstack>
            {/* Render content for other tabs here */}
            <text>Content for selected tab goes here.</text>
          </vstack>
        )}

        {gameData && gameData.topComment && selectedTab === TabType.main && (
          <CommentView
            context={context}
            comment={gameData.topComment}
            commentExpanded={commentExpanded}
            setCommentExpanded={setCommentExpanded}
            textExpanded={textExpanded}
            setTextExpanded={setTextExpanded}
          />
        )}

        <spacer grow />

        {/* HStack with button and dice icon */}
        {selectedTab === TabType.main && (!(allGamesData?.ended ?? false) && !(gameData?.finished ?? false)) && (
          <hstack gap="small" alignment="center bottom" width={100}>
            <button
              appearance="primary"
              grow
              onPress={async () => {
                await castVoteButtonPressed();
              }}
            >
              Cast your vote!
            </button>
            <button icon="random" onPress={async () => setShowDiceRoller(true)}>
              Roll
            </button>
          </hstack>
        )}
      </vstack>

      {showDiceRoller && DiceRollView(context, gameData, setShowDiceRoller)}
    </zstack>
  );
};