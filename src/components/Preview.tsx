import { Devvit } from '@devvit/public-api';

export const CreatePreview = (): JSX.Element => {
  return (
    <vstack width={'100%'} height={'100%'} alignment="center middle">
      <image
        url="D20-loop-all.gif"
        description="Loading…"
        height={'140px'}
        width={'140px'}
        imageHeight={'240px'}
        imageWidth={'240px'}
      />
      <spacer size="small" />
      <text wrap size="large" weight="bold">
        Loading The Dungeon…
      </text>
    </vstack>
  );
};
