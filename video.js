// Builtin with nodejs
const cp = require('child_process');
const readline = require('readline');
const fs = require('fs');
// External modules
const ytdl = require("ytdl-core");
const ffmpeg = require('ffmpeg-static');
const prompt = require('prompt-sync')();

const ref = prompt('Enter the YouTube video URL: ');


// validate the URL
if (!ytdl.validateURL(ref)) {
  console.error('Submitted URL is not a valid YouTube URL. Please submit a valid URL.');
  return;
}

ytdl.getInfo(ref).then(info => {
  let videoTitle = info.videoDetails.title;
  videoTitle = videoTitle
    .replace(/[\s-+|]+/g, '_')
    .replace(/_+/g, '_')

  const outputFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });

  let folderName
  const onHomeVideos = prompt("Do you wish to store the video in the home videos directory?" +
    "\nEnter (y|Y|yes) for 'yes' and any other for 'no': ")
  if (['y', 'yes'].includes(onHomeVideos.toLocaleLowerCase().trim())) {
    folderName = `${require('os').homedir()}/Videos`
  } else {
    folderName = prompt('Enter the output folder path (default: videos): ');
    if (folderName) {
      // throw error if folder does not exist
      if (!fs.existsSync(folderName)) {
        console.error('Submitted folder path does not exist. Please submit a valid folder path.');
        return;
      }
    } else {
      folderName = 'videos'
      // create folder if not exist
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
    }
  }


  const outputFilePath = `${folderName}/${videoTitle}.${outputFormat.container}`;

  const tracker = {
    start: Date.now(),
    audio: { downloaded: 0, total: Infinity },
    video: { downloaded: 0, total: Infinity },
    merged: { frame: 0, speed: '0x', fps: 0 },
  };

  // Get audio and video streams
  const audio = ytdl(ref, { quality: 'highestaudio' })
    .on('progress', (_, downloaded, total) => {
      tracker.audio = { downloaded, total };
    });
  const video = ytdl(ref, { quality: 'highestvideo' })
    .on('progress', (_, downloaded, total) => {
      tracker.video = { downloaded, total };
    });

  // Prepare the progress bar
  let progressBarHandle = null;
  const progressBarInterval = 1000;
  const showProgress = () => {
    readline.cursorTo(process.stdout, 0);
    const toMB = i => (i / 1024 / 1024).toFixed(2);

    process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`);

    process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`);

    process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
    process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`);

    process.stdout.write(`Running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
    readline.moveCursor(process.stdout, 0, -3);
  };

  // Start the ffmpeg child process
  const ffmpegProcess = cp.spawn(ffmpeg, [
    // Remove ffmpeg's console spamming
    '-loglevel', '8', '-hide_banner',
    // Redirect/Enable progress messages
    '-progress', 'pipe:3',
    // Set inputs
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    // Map audio & video from streams
    '-map', '0:a',
    '-map', '1:v',
    // Keep encoding
    '-c:v', 'copy',
    // Define output file
    outputFilePath,
  ], {
    windowsHide: true,
    stdio: [
      /* Standard: stdin, stdout, stderr */
      'inherit', 'inherit', 'inherit',
      /* Custom: pipe:3, pipe:4, pipe:5 */
      'pipe', 'pipe', 'pipe',
    ],
  });
  ffmpegProcess.on('close', () => {
    process.stdout.write('\n\n\n\n');
    clearInterval(progressBarHandle);

    // perform post compression
    const compress = prompt("Do you wish to compress the video for smaller size?" +
      "\nEnter (y|Y|yes) for 'yes' and any other for 'no': ")

    if (['y', 'yes'].includes(compress.toLocaleLowerCase().trim())) {
      // compress using ffmpeg
      const compressOutputFilePath = `${folderName}/${videoTitle}_compressed.${outputFormat.container}`;
      const compressFfmpegProcess = cp.spawn(ffmpeg, [
        '-i', outputFilePath,
        '-vcodec', 'libx264',
        '-crf', '32',
        compressOutputFilePath,
      ]);

      compressFfmpegProcess.on(
        'close', () => {
          process.stdout.write('\n\n\n\n');
          console.log('\nVideo compressed successfully!!!');
          console.log(`Video stored successfully hera at: ${compressOutputFilePath}`);
          fs.unlinkSync(outputFilePath);
        }
      );
    } else {
      console.log('\nVideo downloaded successfully!!!');
      console.log(`Video stored successfully hera at: ${outputFilePath}`);
    }
  });

  // Link streams
  // FFmpeg creates the transformer streams and we just have to insert / read data
  ffmpegProcess.stdio[3].on('data', chunk => {
    // Start the progress bar
    if (!progressBarHandle) progressBarHandle = setInterval(showProgress, progressBarInterval);
    // Parse the param=value list returned by ffmpeg
    const lines = chunk.toString().trim().split('\n');
    const args = {};
    for (const l of lines) {
      const [key, value] = l.split('=');
      args[key.trim()] = value.trim();
    }
    tracker.merged = args;
  });
  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);
}).catch(console.error);
