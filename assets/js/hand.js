/**
 * Created by jcx on 16/6/6.
 */

/**
 *  process:  []
 *
 *  item format:
 *  {
 *      cmd: "raise",
 *      s:   start money,
 *      e:   end money,
 *      place: 1
 *  }
 *  {
 *      cmd: "fold“，
 *      place: 1
 *  }
 *  {
 *      cmd: "return",
 *      s:   start money,
 *      e:   end money,
 *      place: 1
 *  }
 *  {
 *      cmd: "hand",
 *      place: 1,
 *      money: 1.0
 *  }
 *  {
 *      cmd: "check",
 *      place: 1
 *  }
 *  {
 *      cmd: "showdown",
 *      place:  1,
 *      money:  1.0
 *  }
 *  {
 *      cmd: "flop",
 *      card1: "",
 *      card2: "",
 *      card3: ""
 *  }
 *  {
 *      cmd: "turn",
 *      card4: ""
 *  }
 *  {
 *      cmd: "river",
 *      card5: ""
 *  }
 *  {
 *      cmd: "init"
 *      // need to check money in hand object
 *  }
 *
 */

/**
 * hand: {
 *      initState: {
 *          seat"   {1: "UTG" },
 *          people: { "UTG": 1 }
 *      },
 *      process: [
 *      ],
 *      currentIndex:
 * }
 *
 */


var handManager = (function() {
    /**
     *  IdMap:   hand id => hand object index in TotalHands
     *  TotalHands:  hand object list
     */
    var TotalHands = [];
    var IdMap = {};
    var handindex=0;
    var tmpState = {};

    var RegexSet = {
        moneyRegex: /\$([0-9\.]*)/i,
        initCardRegex: /\[([2-9AJQKT][hsdc]) ([2-9AJQKT][hsdc])\]/i,
        flopCardRegex: /\[([2-9AJQKT][hsdc]) ([2-9AJQKT][hsdc]) ([2-9AJQKT][hsdc])\]/i,
        turnCardRegex: /\[([2-9AJQKT][hsdc])\]/i,
        riverCardRegex: /\[([2-9AJQKT][hsdc])\]/i
    };



    function readfilelist(filelist) {
        for (var index in filelist) {
            var data = fs.readFileSync(filelist[index], "utf-8");
            var handlist = dataHandler(data);
            //addFileToList(filelist[filename]);
            addHandlist(filelist[index], handlist);
        }

    }

    function dataHandler(data) {
        var handlist = [];
        var hands = data.split(/\r\n\r\n\r\n/i);
        for (var i in hands) {
            var lines = hands[i].split(/\r\n/i);
            var hand = handleOneHandle(lines);
            IdMap[hand.id] = TotalHands.length;
            TotalHands.push(hand);

            handlist.push(hand.id);

            if (i==1) break;
        }

        return handlist;
    }


    function handleOneHandle(lines) {
        var firstline = lines[0];
        var id = firstline.match(/#\d{10}/i)[0];
        var tabid = firstline.match(/#\d{8}/i)[0];
        var date = firstline.match(/\d{4}-\d{2}-\d{2} \d{1,2}:\d{1,2}:\d{1,2}/i)[0];

        var index = 1;
        var initState = {
            seat: {},
            people: {},
            money: {},
            symbol: "",
            cards: {}
        };
        var hand = {
            id: id,
            tableid: tabid,
            date: date,
            SB: 0,
            BB: 0,
            Dealer: 0,
            myseat: "",
            initState: initState,
            endState: {
                winner: "",
                pot: 0,
                loserlist: []
            },
            process: [],
            currentIndex: 0,

            /* current state */
            foldflag: {},  /* "UTG": true means UTG has folded */
            allroles: [],  /* just now unset */
            pot: 0,        /* current pot number */
            money: {}      /* current everyone's money */
        };
        TotalHands[hand.id] = hand;

        /*  init state */
        while (lines[index].substring(0,3) !== "***") {
            var line = lines[index];
            if (line.substring(0,5) === "Seat ") {
                var num = parseFloat(line[5]);
                var subject = getPlaceFromFirstSixChars(line.substring(8, 18));

                initState.seat[num] = subject;
                initState.people[subject] = num;
                var m = parseFloat((RegexSet.moneyRegex.exec(line))[1]);
                initState.symbol = "$";
                initState.money[subject] = m;

                if (line.indexOf("[ME]") >= 0) {
                    hand.myseat = subject;
                }

                if (subject == "Dealer") {
                    hand.Dealer = num;
                }

            } else if (line.substring(0,6) === "Dealer") {
                var ret = / Set dealer \[(\d)\]/ig.exec(line);
                /* get Dealer's seat */
                var seatnum = ret[1];

            } else if (line.substring(0,5) === "Small") {
                var ret = / Small Blind \$([0-9\.]{1,10})/ig.exec(line);
                var money = ret[1];
                hand.SB = parseFloat(money);


            } else if (line.substring(0,3) === "Big") {
                var ret = / Big blind \$([0-9\.]{1,10})/ig.exec(line);
                var money = ret[1];
                hand.BB = parseFloat(money);
            }

            index ++;
        }

        hand.money = $.extend({}, hand.initState.money);
        hand.money["Big Blind"] -= hand.BB;
        hand.pot += hand.BB;
        if ("Small Blind" in hand.initState.money) {
            hand.money["Small Blind"] -= hand.SB;
            hand.pot += hand.SB;
        }
        setPlayerName();
        setHero(hand.initState.people[hand.myseat]);
        setDealer(hand.Dealer);
        showEveryOneMoney(hand);
        updateMoney(hand.initState.people["Small Blind"], hand.money["Small Blind"]);
        updateMoney(hand.initState.people["Big Blind"], hand.money["Big Blind"]);
        updateBetMoney(hand.initState.people["Small Blind"], hand.SB);
        updateBetMoney(hand.initState.people["Big Blind"], hand.BB);

        hand.process.push({cmd:"init"})

        if (lines[index].indexOf("HOLE CARDS") >= 0) {
            index ++;
        }

        /* *** HOLE CARDS *** */
        while (lines[index].substring(0,3) !== "***") {
            line = lines[index];
            var parts = line.split(":");
            var subject = getPlaceFromFirstSixChars(parts[0]);
            if (line.indexOf("Card dealt to a spot") >= 0) {
                var cards = RegexSet.initCardRegex.exec(line);

                hand.initState.cards[subject] = {1: cards[1], 2: cards[2]};
            } else {
                /* each player's action */
                var t = line.split(":");
                var player = t[0], content = t[1];
                var parts = content.split(" ");

                handleAction(parts, hand, subject);
            }

            index ++;
        }

        if (lines[index].indexOf("FLOP") >= 0) {
            var cards = RegexSet.flopCardRegex.exec(lines[index]);
            hand.publicCard = {1: cards[1], 2: cards[2], 3: cards[3]};

            var step = {};
            step.cmd = "flop";
            step.card1 = cards[1], step.card2 = cards[2], step.card3 = cards[3];
            hand.process.push(step);
            index ++;
        }

        while (lines[index].substring(0,3) !== "***") {
            line = lines[index];
            var parts = line.split(":");
            var subject = getPlaceFromFirstSixChars(parts[0]);

            /* each player's action */
            var t = line.split(":");
            var player = t[0], content = t[1];
            var parts = content.split(" ");

            handleAction(parts, hand, subject);


            index ++;
        }


        if (lines[index].indexOf("TURN") >= 0) {
            var cards = RegexSet.turnCardRegex.exec(lines[index]);
            hand.publicCard[4] = cards[1];

            var step = {};
            step.cmd = "turn";
            step.card4 = cards[1];
            hand.process.push(step);
            index ++;
        }

        while (lines[index].substring(0,3) !== "***") {
            line = lines[index];
            var parts = line.split(":");
            var subject = getPlaceFromFirstSixChars(parts[0]);

            /* each player's action */
            var t = line.split(":");
            var player = t[0], content = t[1];
            var parts = content.split(" ");

            handleAction(parts, hand, subject);

            index++;
        }


        if (lines[index].indexOf("RIVER") >= 0) {
            var cards = RegexSet.riverCardRegex.exec(lines[index]);
            hand.publicCard[5] = cards[1];

            var step = {};
            step.cmd = "river";
            step.card5 = cards[1];
            hand.process.push(step);
            index ++;
        }

        while (lines[index].substring(0,3) !== "***") {
            line = lines[index];
            var parts = line.split(":");
            var subject = getPlaceFromFirstSixChars(parts[0]);

            /* each player's action */
            var t = line.split(":");
            var player = t[0], content = t[1];
            var parts = content.split(" ");

            handleAction(parts, hand, subject);

            index ++;
        }

        //showdownAllCards(hand);

        /* *** SUMMARY *** */

        delete(hand["pot"]);
        delete(hand["money"]);

        return hand;
    }


    function moneyFormat(money) {
        return Math.round(money*100)/100;
    }


    function getPlaceFromFirstSixChars(line) {
        var place = "";
        switch (line.substring(0,6)) {
            case "Small ":
                place = "Small Blind";
                break;
            case "Big Bl":
                place = "Big Blind";
                break;
            case "UTG+1 ":
                place = "UTG+1";
                break;
            case "UTG+2 ":
                place = "UTG+2";
                break;
            case "Dealer":
                place = "Dealer";
                break;
            default:
                if (line.substring(0, 3) == "UTG") {
                    place = "UTG";
                    break;
                }
        }

        return place;
    }

    function updatePot(num) {
        num = moneyFormat(num);
        $("#pot").removeClass("ng-hide").text("Pot: $" + num);
    }

    function updateMoney(seatn, num) {
        num = moneyFormat(num);
        $(".player-wrap[active-seat='"+seatn+"'] .seat .player-content .money")
            .text("$"+num);
    }

    /* seat seatn bet num money */
    function updateBetMoney(seatn, num) {
        num = moneyFormat(num);
        if (num == 0) {
            $(".player-wrap[active-seat='"+seatn+"'] .bets span").addClass("ng-hide");
            return;
        }
        $(".player-wrap[active-seat='"+seatn+"'] .bets span")
            .removeClass("ng-hide")
            .text("$"+num);
    }

    function updateFold(seatn) {
        $(".player-wrap[active-seat='"+seatn+"'] .player-cards").addClass("hide");
    }

    function win(seatn, num) {
        num = moneyFormat(num);
        for (var index=1;index<=6;index++) {
            $(".player-wrap[active-seat='"+index+"'] .bets span")
                .addClass("ng-hide");
        }
        $(".player-wrap[active-seat='"+seatn+"'] .bets span")
            .removeClass("ng-hide")
            .text("$"+num);
    }

    function setDealer(seatn) {
        $(".player-wrap .dealer-button").addClass("ng-hide");
        $(".player-wrap[active-seat='"+seatn+"'] .dealer-button").removeClass("ng-hide");
    }

    function setPlayerName() {
        for (var index=1;index<=6;index++) {
            $(".player-wrap[active-seat='"+index+"'] .seat .sitIn").text("Player "+index);
        }
    }

    function setHero(seatn) {
        $(".player-wrap[active-seat='"+seatn+"'] .seat .sitIn").text("Hero");
    }

    function turnToplayer(seatn) {
        $(".player-wrap .seat").removeClass("active");
        $(".player-wrap[active-seat='"+seatn+"'] .seat").addClass("active");
    }

    function showdownAllCards(hand) {
        for (var i=1;i<=6;i++) {
            showdown(i, hand.initState.cards[hand.initState.seat[i]] );
        }
    }

    function showEveryOneMoney(hand) {
        for (var place in hand.money) {
            updateMoney(hand.initState.people[place], hand.money[place]);
        }
    }

    function showdown(seatn, cards) {
        var $cdiv = $(".player-wrap[active-seat='"+seatn+"'] .player-cards div.card");
        showdowndiv($cdiv.eq(0), cards[1]);
        showdowndiv($cdiv.eq(1), cards[2]);
    }

    function showdowndiv($div, card) {
        var class1 = $div[0].classList;
        for (var i=0;i<class1.length; i++) {
            if (class1[i].length > 5) {
                $div.removeClass(class1[i]);
            }
        }
        $div.addClass("card-"+card);
    }

    function showflop(stepItem) {
        var $div1 = $("#board-wrap div div").eq(0).removeClass("ng-hide");
        var $div2 = $("#board-wrap div div").eq(1).removeClass("ng-hide");
        var $div3 = $("#board-wrap div div").eq(2).removeClass("ng-hide");

        showdowndiv($div1, stepItem.card1);
        showdowndiv($div2, stepItem.card2);
        showdowndiv($div3, stepItem.card3);
    }

    function showturn(stepItem) {
        var $div4 = $("#board-wrap div div").eq(3).removeClass("ng-hide");

        showdowndiv($div4, stepItem.card4);
    }

    function showriver(stepItem) {
        var $div5 = $("#board-wrap div div").eq(4).removeClass("ng-hide");

        showdowndiv($div5, stepItem.card5);
    }

    function hidediv($div) {
        var class1 = $div[0].classList;
        for (var i=0;i<class1.length; i++) {
            if (class1[i].length > 5) {  /*  remove card-xx class */
                $div.removeClass(class1[i]);
            }
        }
        $div.addClass("card-back");
    }

    function hidePublicCards() {
        $("#board-wrap div div").each(function(index, obj) {
            hidediv($(obj));
        });
    }

    function hidePlayerCards() {
        $(".player-wrap[active-seat] .player-cards div").each(function(index, obj) {
            hidediv($(obj));
        });
    }

    function clearAll() {
        hidePublicCards();
        hidePlayerCards();
    }





    function handleAction(parts, hand, subject) {
        var step = {};
        switch (parts[1]) {
            case "Raises":
                var newm = parseFloat(RegexSet.moneyRegex.exec(parts[2])[1]);
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[4])[1]);

                hand.money[subject] -= newm;

                step.cmd = "raise";
                step.place = hand.initState.people[subject];
                step.s = moneyFormat(hand.money[subject]+newm);
                step.e = moneyFormat(hand.money[subject]);

                break;
            case "Folds":

                step.cmd = "fold";
                step.place = hand.initState.people[subject];
                break;
            case "Calls":
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[2])[1]);
                hand.money[subject] -= m;

                step.cmd = "raise";
                step.place = hand.initState.people[subject];
                step.s = moneyFormat(hand.money[subject]+m);
                step.e = moneyFormat(hand.money[subject]);
                break;
            case "Checks":

                step.cmd = "check";
                step.place = hand.initState.people[subject];

                break;
            case "Bets":
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[2])[1]);
                hand.money[subject] -= m;

                step.cmd = "raise";
                step.place = hand.initState.people[subject];
                step.s = moneyFormat(hand.money[subject] + m);
                step.e = moneyFormat(hand.money[subject]);

                break;
            case "All-in":
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[2])[1]);
                hand.money[subject] -= m;

                step.cmd = "raise";
                step.place = hand.initState.people[subject];
                step.s = moneyFormat(hand.money[subject] + m);
                step.e = moneyFormat(hand.money[subject]);

                break;
            case "Return":
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[6])[1]);
                hand.money[subject] += m;

                step.cmd = "return";
                step.place = hand.initState.people[subject];
                step.s = moneyFormat(hand.money[subject] - m);
                step.e = moneyFormat(hand.money[subject]);

                break;
            case "Does":  /* Does not show [xx xx] */
            case "Showdown":
                /* do nothing */

                step.cmd = "showdown";
                step.place = hand.initState.people[subject];

                hand.endState.loserlist.push(step.place);

                break;
            case "Hand":
                var m = parseFloat(RegexSet.moneyRegex.exec(parts[3])[1]);

                step.cmd = "hand";
                step.place = hand.initState.people[subject];
                step.money = moneyFormat(m);

                hand.endState.winner = step.place;
                hand.endState.pot = m;

                for (var i=0;i<hand.endState.loserlist.length;i++) {
                    if (hand.endState.loserlist[i] == step.place) {
                        hand.endState.loserlist.slice(i, 1);
                    }
                }

                break;
            default:
                console.log("unknown action: " + parts[1]);
        }

        hand.process.push(step);
    }

    function initCardState() {
        $(".player-wrap[active-seat] .player-cards").removeClass("hide");
    }


    function processParse(stepItem, hand) {
        switch (stepItem.cmd) {
            case "init":
                clearAll();
                tmpState = {pot: 0};

                tmpState.money = $.extend({}, hand.initState.money);
                tmpState.money["Big Blind"] -= hand.BB;
                tmpState.pot += hand.BB;
                if ("Small Blind" in hand.initState.money) {
                    tmpState.money["Small Blind"] -= hand.SB;
                    tmpState.pot += hand.SB;
                }
                initCardState();
                setPlayerName();
                setHero(hand.initState.people[hand.myseat]);
                setDealer(hand.Dealer);
                showEveryOneMoney(hand);
                updateMoney(hand.initState.people["Small Blind"], tmpState.money["Small Blind"]);
                updateMoney(hand.initState.people["Big Blind"], tmpState.money["Big Blind"]);
                updateBetMoney(hand.initState.people["Small Blind"], hand.SB);
                updateBetMoney(hand.initState.people["Big Blind"], hand.BB);
                updatePot(tmpState.pot);
                break;
            case "raise":
                var m = hand.initState.money[hand.initState.seat[stepItem.place]]
                    - stepItem.e;
                tmpState.pot += (stepItem.e - stepItem.s);

                updateBetMoney(stepItem.place, m);
                updateMoney(stepItem.place, stepItem.e);
                updatePot(tmpState.pot);
                break;
            case "fold":
                hand.foldflag[hand.initState.seat[stepItem.place]] = true;

                updateFold(stepItem.place);
                updateBetMoney(stepItem.place, 0);
                break;
            case "return":

                tmpState.money[hand.initState.seat[stepItem.place]] = stepItem.e;
                var m = hand.initState.money[hand.initState.seat[stepItem.place]]
                    - stepItem.e;
                tmpState.pot -= (stepItem.e - stepItem.s);

                updateBetMoney(stepItem.place, m);
                updateMoney(stepItem.place,
                    tmpState.money[hand.initState.seat[stepItem.place]]);
                updatePot(tmpState.pot);
                break;
            case "hand":
                win(stepItem.place, stepItem.money);
                break;
            case "check":
                break;

            case "showdown":
                showdown(stepItem.place,
                    hand.initState.cards[hand.initState.seat[stepItem.place]]);
                break;

            case "flop":
                showflop(stepItem);
                break;

            case "turn":
                showturn(stepItem);
                break;

            case "river":
                showriver(stepItem);
                break;

            default:
                console.log("unHandled cmd: " + stepItem.cmd);
                break;
        }

    }


    function processReverseParse() {
        ;
    }


    function iterateNextStep() {
        var hand = TotalHands[handindex];
        if (hand.currentIndex >= hand.process.length) return;

        processParse(hand.process[hand.currentIndex], hand);
        hand.currentIndex ++;
        if (hand.currentIndex < hand.process.length)
            turnToplayer(hand.process[hand.currentIndex].place);
    }

    function iteratePrevStep(hand) {
        var hand = TotalHands[handindex];
        if (hand.currentIndex == 0) return;

        hand.currentIndex --;
        processReverseParse(hand.process[hand.currentIndex], hand);
    }

    function nextHand() {
        if (handindex < TotalHands.length) {
            handindex ++;
        }

        restart();
    }

    function prevHand() {
        if (handindex > 0) {
            handindex --;
        }

        restart();
    }

    function restart() {
        TotalHands[handindex].currentIndex = 0;
        clearAll();
    }

    function search(id) {
        if (id in IdMap) {
            handindex = IdMap[id];
            restart();

            return true;
        }

        return false;
    }

    function openHand(id) {
        var index = IdMap[id];
        if (typeof index === "undefined") {
            return
        }

        handindex = index;

        restart();
    }

    return {
        readfilelist: readfilelist,
        nextHand: nextHand,
        prevHand: prevHand,
        iterateNextStep: iterateNextStep,
        iteratePrevStep: iteratePrevStep,
        restart: restart,
        search: search,
        openHand: openHand
    }

})();
