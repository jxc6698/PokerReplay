/**
 * Created by jcx on 16/6/10.
 */


$(function() {
    $('#searchinput').on('keypress', function(e) {
        13 == e.keyCode && searchHand(e.target.value);
    });
});


function searchHand(str) {
    handManager.search(str);
}

function addHandlist(handlist) {
    for (var index in handlist) {
        ;
    }
}