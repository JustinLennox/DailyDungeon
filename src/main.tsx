import './capabilities/actions/index.js';

import { App } from './components/App.js';
import { Devvit, JobContext, MediaPlugin, RedditAPIClient, RedisClient, ScheduledCronJob, ScheduledJob, Scheduler, UIClient } from '@devvit/public-api';
import { CreatePreview } from './components/Preview.js';
import { createPost, fetchGame, installApp, updateGame } from './api/api.js';
import { handleCommentDelete } from './api/handleCommentDelete.js';

// Define what packages you want to use
Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
  http: true,
  kvStore: true,
});

Devvit.addCustomPostType({
  name: 'Reddit Plays DnD',
  height: 'tall',
  render: App,
});

Devvit.addMenuItem({
  label: "Update Reddit Plays DnD",
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    await AddScheduledPostJob(context.scheduler, context.redis, context.ui);
    await AddUpdatePostJob(context.scheduler, context.redis, context.ui);
    await installApp(context);
  },
});

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_, context) => {
    await AddScheduledPostJob(context.scheduler, context.redis, undefined);
    await AddUpdatePostJob(context.scheduler, context.redis, undefined);
    await installApp(context);
  },
});

Devvit.addSchedulerJob({
  name: 'daily_post',
  onRun: async (_, context) => {
    console.log('daily_thread handler called');
    const resp = await createPost(context);
    console.log('posted resp', JSON.stringify(resp));
  },
});

const AddScheduledPostJob = async (scheduler: Scheduler, redis: RedisClient, ui?: UIClient) => {
  try {
    console.log("Trying add scheduler job");
    const previousJobId = await redis.get('daily_post_jobId');
    if (previousJobId) {
      scheduler.cancelJob(previousJobId);
    }
    const jobId = await scheduler.runJob({
      name: 'daily_post',
      cron: '0 15 * * *',
      data: {},
    });
    await redis.set('daily_post_jobId', jobId);
    console.log("Successfully scheduled weekly favorites");
    ui?.showToast({
      text: `Successfully scheduled reddit favorites`,
      appearance: 'success',
    });

  } catch (e) {
    console.log('error was not able to schedule weekly favorites thread:', e);
    ui?.showToast({
      text: `Failed to schedule reddit favorites: ${e}`,
      appearance: 'neutral',
    });
    throw e;
  }
}

const AddUpdatePostJob = async (scheduler: Scheduler, redis: RedisClient, ui?: UIClient) => {
  try {
    console.log("Trying add update post job");
    const previousJobId = await redis.get('update_post_jobId');
    if (previousJobId) {
      scheduler.cancelJob(previousJobId);
    }
    const jobId = await scheduler.runJob({
      name: 'update_post',
      cron: '* * * * *',
      data: {},
    });
    await redis.set('update_post_jobId', jobId);
    console.log("Successfully scheduled post updates");
    ui?.showToast({
      text: `Successfully scheduled post updates`,
      appearance: 'success',
    });

  } catch (e) {
    console.log('error was not able to schedule post updates:', e);
    ui?.showToast({
      text: `Failed to schedule post updates: ${e}`,
      appearance: 'neutral',
    });
    throw e;
  }
}

Devvit.addSchedulerJob({
  name: 'update_post',
  onRun: async (_, context) => {
    console.log('fetch_info handler called');
    try {
      const subreddit = await context.reddit.getCurrentSubreddit();
      await updateGame(context.redis, subreddit.name, context);
    } catch (e) {
      console.error(e);
    }
  },
});

Devvit.addMenuItem({
  label: "Stop Reddit Plays DnD Posts",
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const updateJobID = await context.redis.get('update_post_jobId');
    if (updateJobID) {
      context.scheduler.cancelJob(updateJobID);
    }
    const dailyPostJobID = await context.redis.get('daily_post_jobId');
    if (dailyPostJobID) {
      context.scheduler.cancelJob(dailyPostJobID);
    }

  },
});

Devvit.addTrigger({
  // You can handle multiple events in a single addTrigger call
  // or split them into separate .addTrigger() calls—your choice.
  events: ['CommentDelete'],
  onEvent: async (event, context) => {
    try {
      switch (event.type) {
        case 'CommentDelete': {
          // event.comment is the deleted comment
          const commentID = event.commentId;  // e.g. t1_XXXX
          const subreddit = event.subreddit?.name;
          if (!subreddit) {
            throw new Error(`Failed to delete comment with no subreddit ${event}`);
          }

          // Remove from your own DB/Redis
          await handleCommentDelete(commentID, subreddit);

          break;
        }
      }
    } catch (err) {
      console.error(`Error handling ${event.type} event: `, err);
    }
  },
});

export default Devvit;
