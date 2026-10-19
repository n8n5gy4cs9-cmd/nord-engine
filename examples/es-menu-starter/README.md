# Menu starter (event sheet)
Three scenes: `menu`, `options`, `game`. Buttons are `uiButton` components with an `event` name; each scene's event sheet reacts with **Events → On game event** and switches scenes (*Go to layout*), language (*Localisation*) or volume (*Audio*). Texts use `textKey` + `nord.project.json → strings`, so they follow the language. Replace the `game` scene with yours.
