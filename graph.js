var savedgraphs = [];
var feeds = [];
var feedlist = [];
var embed = false;

var skipmissing = 0;
var requesttype = "interval";
var showcsv = 0;
var showmissing = 0;
var floatingtime=1;
var yaxismin="auto";
var yaxismax="auto";

var previousPoint = 0;

var active_histogram_feed = 0;

$("#info").show();

$("#graph_zoomout").click(function () {floatingtime=0; view.zoomout(); graph_reloaddraw();});
$("#graph_zoomin").click(function () {floatingtime=0; view.zoomin(); graph_reloaddraw();});
$('#graph_right').click(function () {floatingtime=0; view.panright(); graph_reloaddraw();});
$('#graph_left').click(function () {floatingtime=0; view.panleft(); graph_reloaddraw();});
$('.graph_time').click(function () {
    floatingtime=1; 
    view.timewindow($(this).attr("time")); 
    graph_reloaddraw();
});

$('#placeholder').bind("plotselected", function (event, ranges)
{
    floatingtime=0; 
    view.start = ranges.xaxis.from;
    view.end = ranges.xaxis.to;
    view.calc_interval();
    
    graph_reloaddraw();
});

$('#placeholder').bind("plothover", function (event, pos, item) {
    if (item) {
        var z = item.dataIndex;
        
        if (previousPoint != item.datapoint) {
            previousPoint = item.datapoint;

            $("#tooltip").remove();
            var item_time = item.datapoint[0];
            var item_value = item.datapoint[1];

            var d = new Date(item_time);
            var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            var minutes = d.getMinutes();
            if (minutes<10) minutes = "0"+minutes;
            var date = d.getHours()+":"+minutes+" "+days[d.getDay()]+", "+months[d.getMonth()]+" "+d.getDate();
            tooltip(item.pageX, item.pageY, item_value+"<br><span style='font-size:11px'>"+date+"</span>", "#fff");
        }
    } else $("#tooltip").remove();
});

$(window).resize(function(){
    if (!embed) sidebar_resize();
    graph_resize();
    graph_draw();
});

function graph_resize() {
    var top_offset = 0;
    if (embed) top_offset = 35;
    var placeholder_bound = $('#placeholder_bound');
    var placeholder = $('#placeholder');

    var width = placeholder_bound.width();
    var height = width * 0.5;
    if (embed) height = $(window).height();

    placeholder.width(width);
    placeholder_bound.height(height-top_offset);
    placeholder.height(height-top_offset);
}

function graph_init_editor()
{
    // Load saved graphs
    graph_load_savedgraphs();
    
    
    // Load user feeds for editor
    $.ajax({                                      
        url: path+"/feed/list.json",
        async: false,
        dataType: "json",
        success: function(data_in) {
            feeds = data_in;
            
            var out = "";
            for (var z in feeds) {
               out += "<tr>";
               var name = feeds[z].name;
               if (name.length>20) {
                   name = name.substr(0,20)+"..";
               }
               out += "<td>"+name+"</td>";
               out += "<td><input class='feed-select-left' feedid="+feeds[z].id+" type='checkbox'></td>";
               out += "<td><input class='feed-select-right' feedid="+feeds[z].id+" type='checkbox'></td>";
               out += "</tr>";
            }
            $("#feeds").html(out);
            load_feed_selector();
        }
    });
    
    
    $("#reload").click(function(){
        view.start = $("#request-start").val()*1000;
        view.end = $("#request-end").val()*1000;
        view.interval = $("#request-interval").val();
        view.limitinterval = $("#request-limitinterval")[0].checked*1;
        
        graph_reloaddraw();
    });

    $("#showcsv").click(function(){
        if ($("#showcsv").html()=="Show CSV Output") {
            printcsv()
            showcsv = 1;
            $("#csv").show();
            $(".csvoptions").show();
            $("#showcsv").html("Hide CSV Output");
        } else {
            showcsv = 0;
            $("#csv").hide();
            $(".csvoptions").hide();
            $("#showcsv").html("Show CSV Output");
        }
    });
    $(".csvoptions").hide();

    $("body").on("click",".getaverage",function(){
        var feedid = $(this).attr("feedid");
        
        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].getaverage = $(this)[0].checked;
                break;
            }
        }
        graph_draw();
    });

    $("body").on("click",".delta",function(){
        var feedid = $(this).attr("feedid");
        
        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].delta = $(this)[0].checked;
                break;
            }
        }
        graph_draw();
    });
    
    $("body").on("change",".linecolor",function(){
        var feedid = $(this).attr("feedid");
        
        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].color = $(this).val();
                break;
            }
        }
        graph_draw();
    });
    
    $("body").on("change",".fill",function(){
        var feedid = $(this).attr("feedid");
        
        for (var z in feedlist) {
            if (feedlist[z].id==feedid) {
                feedlist[z].fill = $(this)[0].checked;
                break;
            }
        }
        graph_draw();
    });

    $("body").on("click",".feed-select-left",function(){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        
        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 1;
                   loaded = true;
                   $(".feed-select-right[feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        
        if (loaded==false && checked) feedlist.push({id:feedid, name:getfeedname(feedid), yaxis:1, fill:0, scale: 1.0, delta:false, getaverage:false, dp:1, plottype:'lines'});
        graph_reloaddraw();
    });

    $("body").on("click",".feed-select-right",function(){
        var feedid = $(this).attr("feedid");
        var checked = $(this)[0].checked;
        
        var loaded = false;
        for (var z in feedlist) {
           if (feedlist[z].id==feedid) {
               if (!checked) {
                   feedlist.splice(z,1);
               } else {
                   feedlist[z].yaxis = 2;
                   loaded = true;
                   $(".feed-select-left[feedid="+feedid+"]")[0].checked = false;
               }
           }
        }
        
        if (loaded==false && checked) feedlist.push({id:feedid, yaxis:2, fill:0, scale: 1.0, delta:false, getaverage:false, dp:1, plottype:'lines'});
        graph_reloaddraw();
    });

    $("#showmissing").click(function(){
        showmissing = $("#showmissing")[0].checked*1.0;
        graph_draw();
    });

    $("#request-fixinterval").click(function(){
        if ($("#request-fixinterval")[0].checked) view.fixinterval = true; else view.fixinterval = false;
        if (view.fixinterval) {
            $("#request-interval").prop('disabled', true);
        } else {
            $("#request-interval").prop('disabled', false);
        }
    });

    $("#request-type").val("interval");
    $("#request-type").change(function() {
        var type = $(this).val();
        type = type.toLowerCase();
        
        if (type!="interval") {
            $(".fixed-interval-options").hide();
            view.fixinterval = true;
        } else { 
            $(".fixed-interval-options").show();
            view.fixinterval = false;
        }
        
        requesttype = type;
        
        // Intervals are set here for bar graph bar width sizing
        if (type=="daily") view.interval = 86400;
        if (type=="weekly") view.interval = 86400*7;
        if (type=="monthly") view.interval = 86400*30;
        if (type=="annual") view.interval = 86400*365;
        
        $("#request-interval").val(view.interval);
    });

    $("body").on("change",".decimalpoints",function(){
        var feedid = $(this).attr("feedid");
        var dp = $(this).val();
        
        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                feedlist[z].dp = dp;
                
                graph_draw();
                break;
            }
        }
    });

    $("body").on("change",".plottype",function(){
        var feedid = $(this).attr("feedid");
        var plottype = $(this).val();
        
        for (var z in feedlist) {
            if (feedlist[z].id == feedid) {
                feedlist[z].plottype = plottype;
                
                graph_draw();
                break;
            }
        }
    });
    
    $("body").on("change","#yaxis-min",function(){
        yaxismin = $(this).val();
        graph_draw();
    });
    
    $("body").on("change","#yaxis-max",function(){
        yaxismax = $(this).val();
        graph_draw();
    });


    $("#csvtimeformat").change(function(){
        printcsv();
    });

    $("#csvnullvalues").change(function(){
        printcsv();
    });
}

function graph_reloaddraw() {
    graph_reload();
    graph_draw();
}

function graph_reload()
{
    var intervalms = view.interval * 1000;
    view.start = Math.round(view.start / intervalms) * intervalms;
    view.end = Math.round(view.end / intervalms) * intervalms;
    
    $("#request-start").val(view.start*0.001);
    $("#request-end").val(view.end*0.001);
    $("#request-interval").val(view.interval);
    $("#request-limitinterval").attr("checked",view.limitinterval);
    
    var errorstr = "";    
    
    for (var z in feedlist)
    {
        var mode = "&interval="+view.interval+"&skipmissing="+skipmissing+"&limitinterval="+view.limitinterval;
        if (requesttype!="interval") mode = "&mode="+requesttype;
        
        var method = "data";
        if (feedlist[z].getaverage) method = "average";
        var request = path+"feed/"+method+".json?id="+feedlist[z].id+"&start="+view.start+"&end="+view.end + mode;
        
        $.ajax({                                      
            url: request,
            async: false,
            dataType: "text",
            success: function(data_in) {
            
                // 1) Check validity of json data, or show error
                var valid = true;
                try {
                    feedlist[z].data = JSON.parse(data_in);
                    if (feedlist[z].data.success!=undefined) valid = false;
                } catch (e) {
                    valid = false;
                }
                
                if (!valid) errorstr += "<div class='alert alert-danger'><b>Request error</b> "+data_in+"</div>";
            }
        });
        
        if (feedlist[z].delta) {
            for (var i=1; i<feedlist[z].data.length; i++) {
                if (feedlist[z].data[i][1]!=null && feedlist[z].data[i-1][1]!=null) {
                    var delta = feedlist[z].data[i][1] - feedlist[z].data[i-1][1];
                    feedlist[z].data[i-1][1] = delta;
                } else {
                    feedlist[z].data[i][1] = null;
                    feedlist[z].data[i-1][1] = null;
                }
            }
            feedlist[z].data[feedlist[z].data.length-1][1] = null;
        }
        
        // Apply a scale to feed values
        var scale = $(".scale[feedid="+feedlist[z].id+"]").val();
        if (scale!=undefined) feedlist[z].scale = scale;
        
        if (feedlist[z].scale!=undefined && feedlist[z].scale!=1.0) {
            for (var i=0; i<feedlist[z].data.length; i++) {
                if (feedlist[z].data[i][1]!=null) {
                    feedlist[z].data[i][1] = feedlist[z].data[i][1] * feedlist[z].scale;
                }
            }
        }
    }
    
    if (errorstr!="") {
        $("#error").html(errorstr).show();
    } else {
        $("#error").hide();
    }
}

function graph_draw()
{
    var options = {
        lines: { fill: false },
        xaxis: { 
            mode: "time", timezone: "browser", 
            min: view.start, max: view.end
        },
	      yaxes: [ { }, {
			      // align if we are to the right
			      alignTicksWithAxis: 1,
			      position: "right"
			      //tickFormatter: euroFormatter
		    } ],
        grid: {hoverable: true, clickable: true},
        selection: { mode: "x" }
    }
    
    if (yaxismin!='auto' && yaxismin!='') { options.yaxes[0].min = yaxismin; options.yaxes[1].min = yaxismin; }
    if (yaxismax!='auto' && yaxismax!='') { options.yaxes[0].max = yaxismax; options.yaxes[1].max = yaxismax; }
    
    var time_in_window = (view.end - view.start) / 1000;
    var hours = Math.floor(time_in_window / 3600);
    var mins = Math.round(((time_in_window / 3600) - hours)*60);
    if (mins!=0) {
        if (mins<10) mins = "0"+mins;
    } else {
        mins = "";
    }
    
    if (!embed) $("#window-info").html("<b>Window:</b> "+printdate(view.start)+" > "+printdate(view.end)+", <b>Length:</b> "+hours+"h"+mins+" ("+time_in_window+" seconds)");
    
    var plotdata = [];
    for (var z in feedlist) {
        
        var data = feedlist[z].data;
        
        // Hide missing data (only affects the plot view)
        if (!showmissing) {
            var tmp = [];
            for (var n in data) {
                if (data[n][1]!=null) tmp.push(data[n]);
            }
            data = tmp;
        }
        // Add series to plot
        
        var plot = {label:feedlist[z].id+":"+feedlist[z].name, data:data, yaxis:feedlist[z].yaxis, color: feedlist[z].color};
        
        if (feedlist[z].plottype=='lines') plot.lines = { show: true, fill: feedlist[z].fill };
        if (feedlist[z].plottype=='bars') plot.bars = { show: true, barWidth: view.interval * 1000 * 0.75 };
        plotdata.push(plot);
    }
    $.plot($('#placeholder'), plotdata, options);
    
    if (!embed) {
        
        for (var z in feedlist) {
            feedlist[z].stats = stats(feedlist[z].data);
        }
        
        var default_linecolor = "000";
        var out = "";
        for (var z in feedlist) {
            var dp = feedlist[z].dp;
        
            var apiurl = path+"feed/data.json?id="+feedlist[z].id+"&start="+view.start+"&end="+view.end+"&interval="+view.interval+"&skipmissing="+skipmissing+"&limitinterval="+view.limitinterval;
         
            out += "<tr>";
            out += "<td>"+feedlist[z].id+":"+getfeedname(feedlist[z].id)+"</td>";
            out += "<td><select class='plottype' feedid="+feedlist[z].id+" style='width:80px'>";
            
            var selected = "";
            if (feedlist[z].plottype == "lines") selected = "selected"; else selected = "";
            out += "<option value='lines' "+selected+">Lines</option>";
            if (feedlist[z].plottype == "bars") selected = "selected"; else selected = "";
            out += "<option value='bars' "+selected+">Bars</option>";
            out += "</select></td>";
            out += "<td><input class='linecolor' feedid="+feedlist[z].id+" style='width:50px' type='color' value='#"+default_linecolor+"'></td>";
            out += "<td><input class='fill' type='checkbox' feedid="+feedlist[z].id+"></td>";
            var quality = Math.round(100 * (1-(feedlist[z].stats.npointsnull/feedlist[z].stats.npoints)));
            out += "<td>"+quality+"% ("+(feedlist[z].stats.npoints-feedlist[z].stats.npointsnull)+"/"+feedlist[z].stats.npoints+")</td>";
            out += "<td>"+feedlist[z].stats.minval.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.maxval.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.diff.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.mean.toFixed(dp)+"</td>";
            out += "<td>"+feedlist[z].stats.stdev.toFixed(dp)+"</td>";
            out += "<td>"+Math.round((feedlist[z].stats.mean*time_in_window)/3600)+"</td>";
            for (var i=0; i<11; i++) out += "<option>"+i+"</option>";
            out += "</select></td>";
            out += "<td style='text-align:center'><input class='scale' feedid="+feedlist[z].id+" type='text' style='width:50px' value='1.0' /></td>";
            out += "<td style='text-align:center'><input class='delta' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td style='text-align:center'><input class='getaverage' feedid="+feedlist[z].id+" type='checkbox'/></td>";
            out += "<td><select feedid="+feedlist[z].id+" class='decimalpoints' style='width:50px'><option>0</option><option>1</option><option>2</option><option>3</option></select></td>";
            out += "<td><button feedid="+feedlist[z].id+" class='histogram'>Histogram <i class='icon-signal'></i></button></td>";
            // out += "<td><a href='"+apiurl+"'><button class='btn btn-link'>API REF</button></a></td>";
            out += "</tr>";
        }
        $("#stats").html(out);
        
        for (var z in feedlist) {
            $(".decimalpoints[feedid="+feedlist[z].id+"]").val(feedlist[z].dp);
            if ($(".getaverage[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".getaverage[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].getaverage;
            if ($(".delta[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".delta[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].delta;
            $(".scale[feedid="+feedlist[z].id+"]").val(feedlist[z].scale);
            $(".linecolor[feedid="+feedlist[z].id+"]").val(feedlist[z].color);
            if ($(".fill[feedid="+feedlist[z].id+"]")[0]!=undefined)
                $(".fill[feedid="+feedlist[z].id+"]")[0].checked = feedlist[z].fill;
        }
        
        if (showcsv) printcsv();
    }
}

function getfeedname(id) 
{
    for (var z in feeds) {
        if (feeds[z].id == id) {
            return feeds[z].name;
        }
    }
}

//----------------------------------------------------------------------------------------
// Print CSV
//----------------------------------------------------------------------------------------
function printcsv()
{
    var timeformat = $("#csvtimeformat").val();
    var nullvalues = $("#csvnullvalues").val();
    
    var csvout = "";

    var value = [];
    var lastvalue = [];
    var start_time = feedlist[0].data[0][0];
    for (var z in feedlist[0].data) {
        var line = [];
        // Different time format options for csv output
        if (timeformat=="unix") {
            line.push(Math.round(feedlist[0].data[z][0] / 1000));
        } else if (timeformat=="seconds") {
            line.push(Math.round((feedlist[0].data[z][0]-start_time)/1000));
        } else if (timeformat=="datestr") {
            // Create date time string
            var t = new Date(feedlist[0].data[z][0]);
            var year = t.getFullYear();
            var month = t.getMonth()+1;
            if (month<10) month = "0"+month;
            var day = t.getDate();
            if (day<10) day = "0"+day;
            var hours = t.getHours();
            if (hours<10) hours = "0"+hours;
            var minutes = t.getMinutes();
            if (minutes<10) minutes = "0"+minutes;
            var seconds = t.getSeconds();
            if (seconds<10) seconds = "0"+seconds;
            
            var formatted = year+"-"+month+"-"+day+" "+hours+":"+minutes+":"+seconds;
            line.push(formatted);
        }
        
        var nullfound = false;
        for (var f in feedlist) {
            if (value[f]==undefined) value[f] = null;
            lastvalue[f] = value[f];
            if (feedlist[f].data[z]!=undefined) {
            if (feedlist[f].data[z][1]==null) nullfound = true;
            if (feedlist[f].data[z][1]!=null || nullvalues=="show") value[f] = feedlist[f].data[z][1];
            if (value[f]!=null) value[f] = (value[f]*1.0).toFixed(feedlist[f].dp);
            line.push(value[f]+"");
            }
        }
        
        if (nullvalues=="remove" && nullfound) {
            // pass
        } else { 
            csvout += line.join(", ")+"\n";
        }
    }
    $("#csv").val(csvout);
}

//----------------------------------------------------------------------------------------
// Histogram feature
//----------------------------------------------------------------------------------------

// Launch histogram mode for a given feed
$("body").on("click",".histogram",function(){
    $("#navigation").hide();
    $("#histogram-controls").show();
    var feedid = $(this).attr("feedid");
    active_histogram_feed = feedid;
    var type = $("#histogram-type").val();
    var resolution = 1;
    
    var index = 0;
    for (var z in feedlist) {
      if (feedlist[z].id==feedid) {
        index = z;
        break;
      }
    }
    
    if (feedlist[index].stats.diff<5000) resolution = 10;
    if (feedlist[index].stats.diff<100) resolution = 0.1;
    $("#histogram-resolution").val(resolution);
    
    histogram(feedid,type,resolution);
});

// Chage the histogram resolution
$("#histogram-resolution").change(function(){
    var type = $("#histogram-type").val();
    var resolution = $("#histogram-resolution").val();
    histogram(active_histogram_feed,type,resolution);
});

// time at value or power to kwh
$("#histogram-type").change(function(){
    var type = $("#histogram-type").val();
    var resolution = $("#histogram-resolution").val();
    histogram(active_histogram_feed,type,resolution);
});

// return to power graph
$("#histogram-back").click(function(){
    $("#navigation").show();
    $("#histogram-controls").hide();
    graph_draw();
});

// Draw the histogram
function histogram(feedid,type,resolution) 
{    
    var histogram = {};
    var total_histogram = 0;
    var val = 0;
    for (var z in feedlist) {
      if (feedlist[z].id==feedid) {
        var data = feedlist[z].data;
        
        for (var i=1; i<data.length; i++) {
          if (data[i][1]!=null) {
            val = data[i][1];
          }
          var key = Math.round(val/resolution)*resolution;
          if (histogram[key]==undefined) histogram[key] = 0;
          
          var t = (data[i][0] - data[i-1][0])*0.001;
          
          var inc = 0;
          if (type=="kwhatpower") inc = (val * t)/(3600.0*1000.0);
          if (type=="timeatvalue") inc = t;
          histogram[key] += inc;
          total_histogram += inc;
        }
        break;
      }
    }

    // Sort and convert to 2d array
    var tmp = [];
    for (var z in histogram) tmp.push([z*1,histogram[z]]);
    tmp.sort(function(a,b){if (a[0]>b[0]) return 1; else return -1;});
    histogram = tmp;

    var options = {
        series: { bars: { show: true, barWidth:resolution*0.8 } },
        grid: {hoverable: true}
    };
    $.plot("#placeholder",[{data:histogram}], options);
}

//----------------------------------------------------------------------------------------
// Saved graph's feature
//----------------------------------------------------------------------------------------
$("#graph-select").change(function() {
    var name = $(this).val();
    $("#graph-name").val(name);
    $("#graph-delete").show();
    var index = graph_index_from_name(name);
    
    view.start = savedgraphs[index].start;
    view.end = savedgraphs[index].end;
    view.interval = savedgraphs[index].interval;
    view.limitinterval = savedgraphs[index].limitinterval;
    view.fixinterval = savedgraphs[index].fixinterval;
    floatingtime = savedgraphs[index].floatingtime,
    yaxismin = savedgraphs[index].yaxismin;
    yaxismax = savedgraphs[index].yaxismax;
    feedlist = savedgraphs[index].feedlist;
    
    if (floatingtime) {
        var timewindow = view.end - view.start;
        var now = Math.round(+new Date * 0.001)*1000;
        view.end = now;
        view.start = view.end - timewindow;
    }

    $("#yaxis-min").val(yaxismin);
    $("#yaxis-max").val(yaxismax);
    $("#request-fixinterval")[0].checked = view.fixinterval;
    $("#request-limitinterval")[0].checked = view.limitinterval;
    
    load_feed_selector();

    graph_reloaddraw();
});

$("#graph-name").keyup(function(){
    var name = $(this).val();
    
    if (graph_exists(name)) {
        $("#graph-delete").show(); 
    } else { 
        $("#graph-delete").hide();
    }
});

$("#graph-delete").click(function() {
    var name = $("#graph-name").val();
    var updateindex = graph_index_from_name(name);
    
    if (updateindex!=-1) {
        savedgraphs.splice(updateindex,1);
        graph_save();
        feedlist = [];
        graph_reloaddraw();
        $("#graph-name").val("");
        load_feed_selector();
    }
});

$("#graph-save").click(function() {
    var name = $("#graph-name").val();
    
    if (name==undefined || name=="") {
        alert("Please enter a name for the graph you wish to save");
        return false;
    }
    
    var now = Math.round(+new Date * 0.001)*1000;
    if (Math.abs(now - view.end)<120000) {
        floatingtime = 1;
    }
    
    var graph_to_save = {
        name: name,
        start: view.start,
        end: view.end,
        interval: view.interval,
        limitinterval: view.limitinterval,
        fixinterval: view.fixinterval,
        floatingtime: floatingtime,
        yaxismin: yaxismin,
        yaxismax: yaxismax,
        feedlist: JSON.parse(JSON.stringify(feedlist))
    };
    
    // Update or append
    var updateindex = graph_index_from_name(name);
    
    if (updateindex==-1) {
        savedgraphs.push(graph_to_save);
    } else {
        savedgraphs[updateindex] = graph_to_save;
    }
    
    graph_save();
    $("#graph-select").val(name);
});

function graph_exists(name) {
    if (graph_index_from_name(name)!=-1) return true;
    return false;
}

function graph_index_from_name(name) {
    var index = -1;
    for (var z in savedgraphs) {
        if (savedgraphs[z].name==name) index = z;
    }
    return index;
}

function graph_load_savedgraphs()
{
    $.ajax({                                      
        url: path+"/graph/list",
        async: true,
        dataType: "json",
        success: function(result) {
            savedgraphs = result;
            
            var out = "<option>Select graph:</option>";
            for (var z in savedgraphs) {
               var name = savedgraphs[z].name;
               out += "<option>"+name+"</option>";
            }
            $("#graph-select").html(out);
        }
    });
}

function graph_save() {

    // Clean feedlist of data and stats that dont need to be saved
    for (var z in savedgraphs) {
        for (var i in savedgraphs[z].feedlist) {
            delete savedgraphs[z].feedlist[i].data
            delete savedgraphs[z].feedlist[i].stats;
        }
    }
    
    // Save 
    $.ajax({         
        method: "POST",                             
        url: path+"/graph/save",
        data: "mygraphs="+JSON.stringify(savedgraphs),
        async: true,
        dataType: "json",
        success: function(result) {
            if (!result.success) alert("ERROR: "+result);
        }
    });
    
    // Update list
    var out = "<option>Select graph:</option>";
    for (var z in savedgraphs) {
       var name = savedgraphs[z].name;
       out += "<option>"+name+"</option>";
    }
    $("#graph-select").html(out);
}

// ----------------------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------------------
$("#sidebar-open").click(function(){
    $("#sidebar-wrapper").css("left","250px");
    $("#sidebar-close").show();
});

$("#sidebar-close").click(function(){
    $("#sidebar-wrapper").css("left","0");
    $("#sidebar-close").hide();
});

function sidebar_resize() {
    var width = $(window).width();
    var height = $(window).height();
    $("#sidebar-wrapper").height(height-41);
    
    if (width<1024) {
        $("#sidebar-wrapper").css("left","0");
        $("#wrapper").css("padding-left","0");
        $("#sidebar-open").show();
    } else {
        $("#sidebar-wrapper").css("left","250px");
        $("#wrapper").css("padding-left","250px");
        $("#sidebar-open").hide();
        $("#sidebar-close").hide();
    }
}

// ----------------------------------------------------------------------------------------
function load_feed_selector() {
    for (var z in feeds) {
        var feedid = feeds[z].id;
        $(".feed-select-left[feedid="+feedid+"]")[0].checked = false;
        $(".feed-select-right[feedid="+feedid+"]")[0].checked = false;
    }
    
    for (var z in feedlist) {
        var feedid = feedlist[z].id;
        if (feedlist[z].yaxis==1) $(".feed-select-left[feedid="+feedid+"]")[0].checked = true;
        if (feedlist[z].yaxis==2) $(".feed-select-right[feedid="+feedid+"]")[0].checked = true;
    }
}

function printdate(timestamp)
{
    var date = new Date();
    var thisyear = date.getFullYear()-2000;
    
    var date = new Date(timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = date.getFullYear()-2000;
    var month = months[date.getMonth()];
    var day = date.getDate();
    
    var minutes = date.getMinutes();
    if (minutes<10) minutes = "0"+minutes;
    
    var datestr = date.getHours()+":"+minutes+" "+day+" "+month;
    if (thisyear!=year) datestr +=" "+year;
    return datestr;
};
