const webcamElement = document.getElementById('webcam');
const webcam = new Webcam(webcamElement, 'user')
let timeOut, lastImageData;
let canvasSource = $("#canvas-source")[0];
let canvasBlended = $("#canvas-blended")[0];
let contextSource = canvasSource.getContext('2d');
let contextBlended = canvasBlended.getContext('2d');
let drums = {};
const audioPath = "sound"
let volume1 = 0.5;
var slider = document.querySelector(".slider");


slider.oninput = function () {
  volume1 = this.value / 100;
  var output = document.querySelector("#sliderValue");
  output.innerHTML = this.value;
  loadSounds();

}

$('#cur-link').html(window.location);

contextSource.translate(canvasSource.width, 0);
contextSource.scale(-1, 1);
$('.volume-control').hide()

$('.webcam-pause').click(function () {
  if ($('webcam-pause').hasClass('d-none')) {
    $('.webcam-pause').removeClass('d-none');
    webcam.stop();
    cameraStopped();
    setAllDrumReadyStatus(false);
  } else {
    $('.webcam-pause').addClass('d-none');
    webcam.start()
      .then(result => {
        cameraStarted();
        loadSounds();
        startMotionDetection();
      })
      .catch(err => {
        displayError();
      });
  }
})

$('.drum-container').click(function () {
  if (!$('.webcam-pause').hasClass('d-none')) return;
  $('.webcam-pause').removeClass('d-none');
  webcam.stop();
  cameraStopped();
  setAllDrumReadyStatus(false);
})

$('.virtual-drum').on('load', function () {
  var viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  console.log("viewWidth = " + viewWidth);
  console.log("viewHeight = " + viewHeight);
  var ratioWidth = canvasBlended.width / viewWidth;
  var ratioHeight = canvasBlended.height / viewHeight;
  console.log("canvas-width: " + canvasBlended.width);
  console.log("canvas-height: " + canvasBlended.height);
  console.log("viewWidth = " + ratioWidth);
  console.log("viewHeight = " + ratioHeight);
  drums[this.attributes['vd-id'].value] = {
    id: this.attributes['vd-id'].value,
    name: this.attributes['name'].value,
    width: this.width * ratioWidth,
    height: this.height * ratioHeight,
    x: this.x * ratioWidth,
    y: this.y * ratioHeight
  }
}).each(function () {
  if (this.complete) $(this).trigger('load');
});


function startMotionDetection() {
  setAllDrumReadyStatus(false);
  update();
  setTimeout(setAllDrumReadyStatus, 1000, true);
}

var AudioContext = (
  window.AudioContext ||
  window.webkitAudioContext ||
  null
);

function loadSounds() {
  soundContext = new AudioContext();
  bufferLoader = new BufferLoader(soundContext,
    [
      audioPath + '/Crash.mp3',
      audioPath + '/Hi-Hat.mp3',
      audioPath + '/Floor-Tom.mp3',
      audioPath + '/Kick.mp3',
      audioPath + '/Snare.mp3',
    ],
    finishedLoading
  );
  bufferLoader.load();
}

function decreaseVolume(buffer, amount) {
  var newBuffer = soundContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (var i = 0; i < buffer.numberOfChannels; i++) {
    var channelData = buffer.getChannelData(i);
    var newChannelData = newBuffer.getChannelData(i);
    for (var j = 0; j < buffer.length; j++) {
      newChannelData[j] = channelData[j] * amount;
    }
  }
  return newBuffer;
}
function finishedLoading(bufferList) {
  for (var i = 0; i < 5; i++) {
    // var source = soundContext.createBufferSource();
    var decreasedBuffer = decreaseVolume(bufferList[i], volume1);
    var source = soundContext.createBufferSource();
    source.buffer = decreasedBuffer;
    // source.buffer = bufferList[i];
    source.connect(soundContext.destination);
    drums[i].sound = source;
    drums[i].ready = true;
  }
}

function playHover(drum) {
  if (!drum.ready) return;
  var source = soundContext.createBufferSource();
  source.buffer = drum.sound.buffer;
  source.connect(soundContext.destination);
  source.start(0);
  console.log('played')
  drum.ready = false;
  playAnimate(drum);
  // throttle the note
  setTimeout(setDrumReady, 500, drum);
}

function setDrumReady(drum) {
  drum.ready = true;
}

window.requestAnimFrame = (function () {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

function update() {
  drawVideo();
  blend();
  checkAreas();
  requestAnimFrame(update);
}

function drawVideo() {
  contextSource.drawImage(webcamElement, 0, 0, webcamElement.width, webcamElement.height);
}

function blend() {
  var width = canvasSource.width;
  var height = canvasSource.height;
  // get webcam image data
  var sourceData = contextSource.getImageData(0, 0, width, height);
  // create an image if the previous image doesn’t exist
  if (!lastImageData) lastImageData = contextSource.getImageData(0, 0, width, height);
  // create a ImageData instance to receive the blended result
  var blendedData = contextSource.createImageData(width, height);
  // blend the 2 images
  differenceAccuracy(blendedData.data, sourceData.data, lastImageData.data);
  // draw the result in a canvas
  contextBlended.putImageData(blendedData, 0, 0);
  // store the current webcam image
  lastImageData = sourceData;
}

function fastAbs(value) {
  //equal Math.abs
  return (value ^ (value >> 31)) - (value >> 31);
}

function threshold(value) {
  return (value > 0x15) ? 0xFF : 0;
}

function differenceAccuracy(target, data1, data2) {
  if (data1.length != data2.length) return null;
  var i = 0;
  while (i < (data1.length * 0.25)) {
    var average1 = (data1[4 * i] + data1[4 * i + 1] + data1[4 * i + 2]) / 3;
    var average2 = (data2[4 * i] + data2[4 * i + 1] + data2[4 * i + 2]) / 3;
    var diff = threshold(fastAbs(average1 - average2));
    target[4 * i] = diff;
    target[4 * i + 1] = diff;
    target[4 * i + 2] = diff;
    target[4 * i + 3] = 0xFF;
    ++i;
  }
}

function checkAreas() {
  // loop over the drum areas
  for (var drumName in drums) {
    var drum = drums[drumName];
    if (drum.x > 0 || drum.y > 0) {
      var blendedData = contextBlended.getImageData(drum.x, drum.y, drum.width, drum.height);
      var i = 0;
      var average = 0;
      // loop over the pixels
      while (i < (blendedData.data.length * 0.25)) {
        // make an average between the color channel
        average += (blendedData.data[i * 4] + blendedData.data[i * 4 + 1] + blendedData.data[i * 4 + 2]) / 3;
        ++i;
      }
      // calculate an average between of the color values of the drum area
      average = Math.round(average / (blendedData.data.length * 0.25));
      if (average > 20) {
        // over a small limit, consider that a movement is detected
        // play a note and show a visual feedback to the user
        //console.log(drum.name + '-' + average)
        playHover(drum);
      }
    }
  }
}

function playAnimate(drum) {
  if (drum.name == "crash" || drum.name == "hi-hat") {
    $('[name="' + drum.name + '"]').effect("shake", { times: 1, distance: 5 }, 'fast');
  }
  else {
    var glowing = $("#" + drum.name + "-glowing");
    glowing.removeClass("d-none");
    glowing.height(glowing[0].clientWidth);
    setTimeout(function () { glowing.addClass("d-none"); }, 500);
  }
}

function setAllDrumReadyStatus(isReady) {
  for (var drumName in drums) {
    drums[drumName].ready = isReady;
  }
}

function cameraStarted() {
  $(canvasBlended).delay(600).fadeIn();
  $(".motion-cam").delay(600).fadeIn();
  console.log("camera started");
  $("#wpfront-scroll-top-container").addClass("d-none");
}

function cameraStopped() {
  $("#webcam-caption").html("Click to Start Webcam");
}

$(document).ready(function () {
  $('#sidebarCollapse').on('click', function () {
    $('#sidebar').toggleClass('active');
    $('#exampleModalCenter').modal('toggle');

  });
});

$('#volume-wrapper').on('mouseenter', function () {
  $('.volume-control').show()
})


$('#volume-wrapper').on('mouseleave', function () {
  $('.volume-control').hide()
})

$('#li-share').on('click', function () {
  console.log('on')
  document.getElementById('myModal').style.visibility = 'visible';
})

$('#modal-close').on('click', function () {
  console.log('close');
  document.getElementById('myModal').style.visibility = 'hidden';
})
