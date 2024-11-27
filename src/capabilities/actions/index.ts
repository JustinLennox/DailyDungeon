import { Devvit, useForm } from '@devvit/public-api';
import { createPost } from '../../api/api.js';
import { CreatePreview } from '../../components/Preview.js';

/*
Menu action to create an experience post.
 */
Devvit.addMenuItem({
  label: 'New Reddit Plays DnD post',
  location: 'subreddit',
  onPress: async (_event, context) => {
    await createPost(context, context.ui);
  }
});

const form = Devvit.createForm(
  {
    title: 'Upload an image!',
    fields: [
      {
        name: 'myImage',
        type: 'image', // This tells the form to expect an image
        label: 'Image goes here',
        required: true,
      },
    ],
  },
  (event, context) => {
    const imageUrl = event.values.myImage;
    console.log("Image url: ", imageUrl);
    context.ui.showToast(imageUrl);
    // uploadImage(imageUrl)
    // Use the mediaUrl to store in redis and display it in an <image> block, or send to external service to modify
  }
);

// const uploadImage = async (context: Devvit.Context, imageUrl: string) => { 
//   await context.media.upload({
//     url: imageUrl,
//     type:
//   });
// }

Devvit.addMenuItem({
  location: 'post',
  label: 'Upload Stuff',
  onPress: async (event, context) => {
    console.log(`Invoked action on comment ${event.targetId}`);
    try {
      console.log(event, context);
      context.ui.showForm(form);
      // await context.media.upload({
      //   url: 'https://media2.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy.gif',
      //   type: 'gif',
      // });
    } catch (err) {
      throw new Error(`Error uploading media: ${err}`);
    }
  },
});

// Devvit.addMenuItem({
//   location: 'post',
//   label: 'Reply with Dice Roll',
//   onPress: async (event, context) => {
//     console.log(`Invoked action on comment ${event.targetId}`);
//     try {
//       console.log(event, context);
//       await context.reddit.submitComment({
//         id: event.targetId, // where context menu action was invoked
//         text: 'Hello World with Media',
//       });
//     } catch (err) {
//       throw new Error(`Error uploading media: ${err}`);
//     }
//   },
// });

// Devvit.addMenuItem({
//   location: 'comment',
//   label: 'Reply with Dice Roll',
//   onPress: async (event, context) => {
//     console.log(`Invoked action on comment ${event.targetId}`);
//     try {
//       console.log(event, context);
//       await context.reddit.submitComment({
//         id: event.targetId, // where context menu action was invoked
//         text: 'Hello World with Media',
//       });
//     } catch (err) {
//       throw new Error(`Error uploading media: ${err}`);
//     }
//   },
// });