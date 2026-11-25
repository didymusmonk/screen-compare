# True Size Screens

Compare phone, tablet, laptop, tablet PC (including Surface Pro) and monitor screens at true relative size.

- Search 246 built-in devices, or enter your own screen (diagonal plus resolution or aspect ratio)
- See each screen's pixel density (PPI), resolution, aspect ratio and physical size
- Preview how Letter, A4, Legal and other page sizes, or your own PDF, fit on each screen
- Side by side, overlay, or free arrange with drag, snapping guides and rotation
- Calibrate "Actual size" with a bank card to see screens at real size on your monitor

It's a single static `index.html` with no build step and no server. PDFs open in your browser and are never uploaded.

## Adding or fixing a device

The built-in list is in [`devices.csv`](devices.csv), one screen per line:

```
name,type,diagonal,width,height
Surface Pro 9,tablet pc,13.0,2880,1920
```

- **type** is one of `phone`, `tablet`, `ereader`, `tablet pc`, `laptop`, `monitor`
- **diagonal** is in inches, and **width** and **height** are the screen's pixel count
- Wrap a name in double quotes if it contains a comma, and write a `"` inside a quoted name as `""`

To edit it on GitHub, open `devices.csv`, click the pencil icon, make your change and click **Commit changes**. The live site updates in a minute or two.
