// TabView.tsx
import { Devvit, StateSetter } from "@devvit/public-api";
import { TabType } from "../utils/utils.js";

interface TabsViewProps {
	context: Devvit.Context;
	game: any;
	selectedTab: TabType;
	setSelectedTab: StateSetter<number>;
	currentDay: number;
	setCurrentDay: StateSetter<number | null>;
	maxDay: number;
}

export const TabsView = ({
	context,
	game,
	selectedTab,
	setSelectedTab,
	currentDay,
	setCurrentDay,
	maxDay,
}: TabsViewProps): JSX.Element => {
	const getTabTitle = (tab: TabType): string => {
		switch (tab) {
			case TabType.main:
				return currentDay !== undefined ? `Day ${currentDay + 1}` : `${currentDay}`;
			case TabType.past:
				return "Past Days";
			// Add more tabs here as needed
			default:
				return "";
		}
	};

	const TabView = (tabType: TabType): JSX.Element => {
		return (
			<vstack>
				<button
					appearance="media"
					size="small"
					textColor="white"
					onPress={async () => setSelectedTab(tabType)}
				>
					{getTabTitle(tabType)}
				</button>
				<hstack
					height="1.5px"
					width="100%"
					backgroundColor={selectedTab === tabType ? "red" : "transparent"}
				></hstack>
			</vstack>
		);
	};

	return (
		<hstack width="100%" alignment="start middle" gap="none">
			{/* Render arrows only on the main tab */}
			{selectedTab === TabType.main && (
				<>
					{/* Furthest Left Arrow (Jump to Day 0) */}
					{currentDay > 0 && (
						<button
							appearance="media"
							size="medium"
							textColor="white"
							onPress={async () => setCurrentDay(0)}
						>
							⇤
						</button>
					)}
					{/* Left Arrow (Previous Day) */}
					{currentDay > 0 && (
						<button
							appearance="media"
							size="medium"
							textColor="white"
							onPress={async () => setCurrentDay(currentDay - 1)}
						>
							←
						</button>
					)}
				</>
			)}
			{/* Main Tab with Day Number */}
			{TabView(TabType.main)}
			{/* Render arrows only on the main tab */}
			{selectedTab === TabType.main && (
				<>
					{/* Right Arrow (Next Day) */}
					{currentDay < maxDay && (
						<button
							appearance="media"
							size="medium"
							textColor="white"
							onPress={async () => {
								console.log("Current day is ", currentDay);
								setCurrentDay(currentDay + 1);
							}}
						>
							→
						</button>
					)}
					{/* Furthest Right Arrow (Jump to Latest Day) */}
					{currentDay < maxDay && (
						<button
							appearance="media"
							size="medium"
							textColor="white"
							onPress={async () => {
								console.log("Far right");
								setCurrentDay(maxDay);
							}}
						>
							⇥
						</button>
					)}
				</>
			)}
		</hstack>
	);
};
