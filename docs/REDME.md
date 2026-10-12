# How i work with AI

Working with AI is rather simple once you know what you want from the target, then you just desribe what you want and it can figure out the rest.

However this being said it does have a few shortcommings like not always knowing what technology might be best for the situation so it must be guided through this, or have it give you options and choose from them, which i doi quiet often but i do my research. Since when using AI and not knowing what the output does can be very dangerous and very expensive, on the other hand if you know what it makes and what it should make it can be a priceless tool.

## My usage in this particular case

Precise commands you can see in the logs.

I started off by giving the agent translated version of the task assigned, since i mysefl am not very well versed in the sector this task targets, so i gave it word for word, and added some specifics like the target deployment and that this time it is meant to be on GitHub.

From there the agent took off by itself, ran rather cleanly since it did not have any specific style in mind it could do whatever it liked, and i would just guide it trought the specifics that i might not like. The orginal design was pretty strong, somewhat targeted as learning experience, but it all worked.
However the design had to chnage to a more modern style that i thought would bring more the feeling of being in the action itself, like it already is the platform for where to get the the user wants.
So the agent was tasked with making options for different design that seems more dark, since often for example if a young person wants to get into ETFs, they start on YouTube and most of the platforms look the same. So the agent presented me with options and i chose one of them i liked the most.

After that i went to look at the code and found out that it was written correctly but sincei did not specify the technology it chose base JS, which i did not want cause i myself have a problem navigating it since it can be quite verbose. So i had it refactor it to use Astro with Vue and Typescript. Astro i heard about i another session with Claude, Vue i know well.

After that it was mainly testing, and fining details, like the glow around the input, and buttons, that was not there, but i thought it would attract attention, so i had Claude add it.

I do belive that i had the agent setup the Vercel hosting, it just needed the key to the project so that it can deploy it automatically.

And lastly i had it add PostHog to tract the usage of the page, I myself have never used this, and had never thought about tracking page usage, so this is completetely new to me, but it would seem that the AI had it under control. I would just use Sentry to tract crashes, but that is just not needed here.

Now that i have come back to it after some time i looked at it ad saw that there is a bunch of styles in place, so i had claude make it use Tailwind so that it is more readable.