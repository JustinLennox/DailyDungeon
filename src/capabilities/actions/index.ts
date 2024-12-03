import { Devvit, useForm, RichTextBuilder } from '@devvit/public-api';
import { createPost, getUserDiceRoll } from '../../api/api.js';
import { CreatePreview } from '../../components/Preview.js';
import { RollDice } from '../../api/RollDice.js';

/*
Menu action to create an experience post.
 */
Devvit.addMenuItem({
  label: 'New Reddit Plays DnD post',
  forUserType: 'moderator',
  location: 'subreddit',
  onPress: async (_event, context) => {
    await createPost(context, context.ui);
  }
});

// const form = Devvit.createForm(
//   {
//     title: 'Upload an image!',
//     fields: [
//       {
//         name: 'myImage',
//         type: 'image', // This tells the form to expect an image
//         label: 'Image goes here',
//         required: true,
//       },
//     ],
//   },
//   (event, context) => {
//     const imageUrl = event.values.myImage;
//     console.log("Image url: ", imageUrl);
//     context.ui.showToast(imageUrl);
//     // uploadImage(imageUrl)
//     // Use the mediaUrl to store in redis and display it in an <image> block, or send to external service to modify
//   }
// );

// const uploadImage = async (context: Devvit.Context, imageUrl: string) => { 
//   await context.media.upload({
//     url: imageUrl,
//     type:
//   });
// }

// Devvit.addMenuItem({
//   location: 'post',
//   label: 'Upload Stuff',
//   onPress: async (event, context) => {
//     console.log(`Invoked action on comment ${event.targetId}`);
//     try {
//       console.log(event, context);
//       context.ui.showForm(form);
//       // await context.media.upload({
//       //   url: 'https://media2.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy.gif',
//       //   type: 'gif',
//       // });
//     } catch (err) {
//       throw new Error(`Error uploading media: ${err}`);
//     }
//   },
// });

Devvit.addMenuItem({
  location: 'comment',
  label: 'Reply with Dice Roll',
  onPress: async (event, context) => {
    console.log(`Invoked action on comment ${event.targetId}`);
    context.ui.showToast("Rolling…");
    try {
      const existingComment = await context.reddit.getCommentById(event.targetId);
      const post = await context.reddit.getPostById(existingComment.postId);
      const allGamesDataString = await context.redis.get("game");
      const allGamesData = allGamesDataString ? JSON.parse(allGamesDataString) : null;
      const gameDay = allGamesData && allGamesData.posts && (allGamesData.posts[post.id] ?? allGamesData.currentDay);
      const gameData = allGamesData && allGamesData.contentArray && gameDay && allGamesData.contentArray[gameDay];
      console.log("Rolling with post ID ", post.id, ", game day: ", gameDay, " and game data ", gameData);
      const diceRoll = await RollDice({ context: context, gameData: gameData, fromComments: true });
      if (!diceRoll) {
        throw new Error("Failed to roll dice.");
      }

      const user = await context.reddit.getCurrentUser();
      console.log("Rolling dice with user: ", user);

      // Build the rich text comment
      let richtext = new RichTextBuilder()
        // .paragraph((p) => {
        //   user?.username ?
        //     p.userMention({ username: user?.username, showPrefix: true })
        //     :
        //     p.text({ text: "I" })
        // })
        .paragraph((p) => {
          p.text({ text: `${user?.username ?? "You"} rolled: ${diceRoll}`})
        })

      if (diceRoll === 1) {
        richtext
          .paragraph((p) => {
            p.text({ text: "Critical Failure!" })
          })
      } else if (diceRoll === 20) {
        richtext
          .paragraph((p) => {
            p.text({ text: "Critical Success!" })
          })
      }

      // Submit the comment with rich text
      const comment = await context.reddit.submitComment({
        id: event.targetId, // The comment where the action was invoked
        richtext: richtext,
      });
      context.ui.showToast(`You rolled: ${diceRoll}!`)
      context.ui.navigateTo(existingComment);
    } catch (err) {
      console.error(`Error rolling dice: ${err}`);
      context.ui.showToast("Something went wrong rolling the dice.");
    }
  },
});