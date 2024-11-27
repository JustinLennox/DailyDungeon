import { Devvit, StateSetter } from "@devvit/public-api"
import { TabType } from "../utils/utils.js"

export const TabsView = (context: Devvit.Context, game: any, selectedTab: TabType, setSelectedTab: StateSetter<number>): JSX.Element => {

	const getTabTitle = (game: any, tab: TabType): string => {
		switch (tab) {
			case TabType.main:
				return game && game.day ? `Day ${game.day + 1}` : "Today";
			case TabType.past:
				return "Past Days";
		}
	}

	const TabView = (tabType: TabType): JSX.Element => {
		return (
			<vstack>
				<button appearance="plain" size="small" onPress={() => setSelectedTab(tabType)}>
					{getTabTitle(game, tabType)}
				</button>
				<hstack height='1.5px' width='100%' backgroundColor={selectedTab == tabType ? 'red' : 'transparent'}></hstack>
			</vstack>
		)
	}
	return (
		<hstack width="100%" alignment="start">
			{TabView(TabType.main)}
			{TabView(TabType.past)}
		</hstack>
	)
}