/**
 * Created by jcx on 16/5/31.
 */
var fs = require("fs");



$(function() {
    $("#prevhand").on("click", function(e) {
        handManager.prevHand();
    });
    $("#nexthand").on("click", function(e) {
        handManager.nextHand();
    });
    $("#prevaction").on("click", function(e) {
        handManager.iteratePrevStep();
    });
    $("#nextaction").on("click", function(e) {
        handManager.iterateNextStep();
    });
    $("#restart").on("click", function(e) {
        handManager.restart();
    });


    $("#inputfilebtn").on('click', function(e) {
        var $delegate = $(e.delegateTarget);
        $delegate.find("input").click();

        e.stopPropagation();
    });
    $("#inputfilebtn > input").on('click', function(e) {
        e.stopPropagation();
    }).on('change', function(e) {
        var filenamestr = $(e.target).val();
        var filenames = filenamestr.split(";");

        handManager.readfilelist(filenames);
    });

    showCards();

    //handManager.readfilelist([
    //    "/Users/jcx/Documents/data/bodogrecord/HH20160528-101735 - 4268525 - RING - $0.02-$0.05 - HOLDEM - NL - TBL No.10743295.txt"])

});



function showCards() {
    $(".player-cards").addClass('dealt');
}

