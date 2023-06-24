const fs = require('fs');
const ytdl = require('ytdl-core');
const cliProgress = require('cli-progress');
const prompt = require('prompt-sync')();

// Function to display progress bar
function showProgressBar(totalSize) {
  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading | {bar} | {percentage}% | ETA: {eta}s | {value}/{total} MB',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(totalSize, 0);

  return progressBar;
}

// Function to download and convert video to MP3
async function downloadMP3(url) {
  try {
    // Fetch video info
    const info = await ytdl.getInfo(url);
    const videoDetails = info.videoDetails;
    const { title, lengthSeconds } = videoDetails;
    const author = videoDetails.author.name;
    const thumbnailUrl = videoDetails.thumbnails.pop().url;

    console.log('Video Details:');
    console.log(`Title: ${title}`);
    console.log(`Author: ${author}`);
    console.log(`Thumbnail URL: ${thumbnailUrl}`);
    console.log('\n');

    // Prompt for the output file name
    let fileName = prompt('Enter the output file name (without extension)' +
      ' or press enter to use the default file name: ');
    if (!fileName) {
      fileName = title
    }
    fileName = fileName
      .replace(/[\s-+|.]+/g, '_')
      .replace(/_+/g, '_')

    let folderName
    let onHomeMusic = prompt("Do you wish to store the mp3 in the home music directory?" +
      "\nEnter (y|Y|yes) for 'yes' and any other for 'no': ")

    if (['y', 'yes'].includes(onHomeMusic.toLocaleLowerCase().trim())) {
      folderName = `${require('os').homedir()}/Music`
    } else {
      folderName = prompt('Enter the output folder path: ');
      if (folderName) {
        if (!fs.existsSync(folderName)) {
          console.error('Submitted folder path does not exist. Please submit a valid folder path.');
          return;
        }
      } else {
        folderName = 'mp3'
        // create folder if not exist
        if (!fs.existsSync(folderName)) {
          fs.mkdirSync(folderName);
        }
      }
    }

    const outputFilePath = `${folderName}/${fileName}.mp3`;

    // Start the download and conversion process
    const audioReadableStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
    const outputStream = fs.createWriteStream(outputFilePath);
    const progressBar = showProgressBar(lengthSeconds);

    audioReadableStream.pipe(outputStream);

    // Update progress bar based on data received
    audioReadableStream.on('data', (chunk) => {
      progressBar.increment(chunk.length);
    });

    // Handle download completion
    audioReadableStream.on('end', () => {
      progressBar.stop();
      console.log(`\nAudio downloaded and converted successfully! Saved as: ${outputFilePath}`);
    });

    // Handle errors during download
    audioReadableStream.on('error', (error) => {
      progressBar.stop();
      console.error('Error occurred during download:', error);
    });
  } catch (error) {
    console.error('Error fetching video info:', error);
  }
}

// Prompt for YouTube video URL
const videoUrl = prompt('Enter the YouTube video URL: ');

// Start the download process
downloadMP3(videoUrl);