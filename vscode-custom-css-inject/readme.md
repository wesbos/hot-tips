## VS Code Custom CSS with live reload

Hi, this is kind of early, and might not work. I made this because the "custom CSS" VS Code extension never worked properly for me and it didn't live reload.

This script does a few things:

1. Injects the custom css from `custom.css` into your VS Code `workbench.html` - this is the main HTML file that VS code launches from and putting custom CSS into this file will be applied to anything in the editor.
2. Starts a websocket server, so that when you change your CSS, it will inject it into the DOM of your VS Code. This gives you live reload of your CSS. No need "Reload window" on every CSS change.

How to use:

1. npm install
1. Edit server.ts for the location of your workbench.html file
1. npm start
1. Reload your VS Code once via `Developer: Reload Window`. This will cause the custom JS to connect to the websocket server.

## Things you should know

1. VS Code doesn't like you messin' with internals. You might get a warning about it being "Corrupt"
2. You probably need to re-run this script when VS Code updates.
3. To find out which classes to use, you can use `Help` → `Toggle Developer tools`
