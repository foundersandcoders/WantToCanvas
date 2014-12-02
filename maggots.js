function setCanvas() {

    var canvasNode = document.getElementById('gameCanvas');

    var pw = canvasNode.parentNode.clientWidth;
    var ph = canvasNode.parentNode.clientHeight;

    canvasNode.height = pw * 0.8 * (canvasNode.height / canvasNode.width);
    canvasNode.width = pw * 0.8;
    canvasNode.style.top = (ph - canvasNode.height) / 2 + "px";
    canvasNode.style.left = (pw - canvasNode.width) / 2 + "px";

}

window.onresize = setCanvas;
setCanvas();
