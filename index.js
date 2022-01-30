//https://github.com/SignalK/signalk-server-node/blob/master/SERVERPLUGINS.md

module.exports = function (app) {
  var plugin = {};



  plugin.id = 'signalk-detect-outliers';
  plugin.name = 'Plugin that filters corrupt data samples from incoming data stream';
  plugin.description = 'Check new sensor readings before they go into sk, if value deemed corrupt then set value to null or drop delta';


  plugin.start = function (options, restartPlugin) {
    app.debug('Plugin started');

    // Initialising
    var AWS_last = 0.0001;
    var send = 1;          // toggle to control execution of next(delta)
    let selfUUID = app.selfContext


    // Capture incoming delta, if valid data then forward to sk-server, otherwise set to null or drop delta
    //   If the delta contains more values than just the one that is checked for corrupt data, all are dropped.
    app.registerDeltaInputHandler((delta, next) => {
      send = 1 // reset toggle

      // Treat only deltas from 'self'
      if(delta.context == selfUUID) {
        delta.updates.forEach(update => {
          update.values.forEach(pathValue => {


            if(pathValue.path === "environment.depth.belowTransducer") {
              if(pathValue.value > options.threshold_depth ) {
                if(options.sendOutlierPath){        
                  // send corrupt data to PATH_outlier
                  app.handleMessage('signalk-detect-outliers', {
                    updates: [
                      {
                        values: [
                          {
                            path: 'environment.depth.belowTransducer_outlier',
                            value: pathValue.value
                          }
                        ]
                      }
                    ]
                  })
                } // if(options.sendOutlierPath){

                pathValue.value = null // update path with 'null' to not show old data
              } // if(pathValue.value
            } // if(pathValue.path === ...



            if(pathValue.path === "navigation.speedThroughWater") {
              if(pathValue.value > (options.threshold_STW * 0.5144) ) {
                if(options.sendOutlierPath){        
                  // send corrupt data to PATH_outlier
                  app.handleMessage('signalk-detect-outliers', {
                    updates: [
                      {
                        values: [
                          {
                            path: 'navigation.speedThroughWater_outlier',
                            value: pathValue.value
                          }
                        ]
                      }
                    ]
                  })
                } // if(options.sendOutlierPath){

                pathValue.value = null // update path with 'null' to not show old data
              } // if(pathValue.value
            } // if(pathValue.path === ...



            if(pathValue.path === "environment.wind.speedApparent") {
              corrupt = 0
              // Capture occasional samples where sensor incorrectly reports AWS close to zero
              if(( (pathValue.value / AWS_last) > options.allowedChange_AWS/100) || (pathValue.value == 0.0) ) {
                //app.debug("wind ok ", AWS_last)
                AWS_last = pathValue.value
                corrupt = 0
              } else {
                corrupt = 1
              }

              if(pathValue.value > options.AWS_maxValue*0.5144) {
                corrupt = 1
              }

              if(corrupt===1){
                //app.debug("wind corrupt", (pathValue.value / AWS_last), options.allowedChange_AWS/100, pathValue.value)
                if(options.sendOutlierPath){        
                  // send corrupt data to PATH_outlier
                  app.handleMessage('signalk-detect-outliers', {
                    updates: [
                      {
                        values: [
                          {
                            path: 'environment.wind.speedApparent_outlier',
                            value: pathValue.value
                          }
                        ]
                      }
                    ]
                  })
                } // if(options.sendOutlierPath){

                pathValue.value = null // update path with 'null' to not show old data
              } // if(corrupt
            } // if(pathValue.path === ...



            if(pathValue.path === "navigation.position") {
              // Drop sample is lat or lon is NaN or if position is [0.0,0.0]
              if(isNaN(pathValue.value.latitude) || isNaN(pathValue.value.longitude) || ( options.filterPositionZero && (Math.abs(pathValue.value.latitude) < 0.00001) && (Math.abs(pathValue.value.longitude) < 0.00001) ) ){
                // set toggle to suppress next(delta) later on
                send = 0 
                if(false) {
                  app.handleMessage('signalk-detect-outliers', {
                    updates: [
                      {
                        values: [
                          {
                            path: 'navigation.position_outlier',
                            value: 1.0 
                          }
                        ]
                      }
                    ]
                  })
                }
              }
            } // if(pathValue.path === ...


          }) // update.values.forEach
        }) // delta.updates.forEach
      } // if(self)



      // drop delta if send == 0
      if(send != 0){
        next(delta)
      }



      // debugging ...
      if(false){
      //if(send == 0){
        app.debug(delta)
        app.debug('CONTENTS OF DELTA FROM GPS')
        delta.updates.forEach(update => {
          update.values.forEach(pathValue => {
            app.debug(pathValue.path)
            if(pathValue.path === "navigation.position") {
              app.debug(pathValue.value.latitude, pathValue.value.longitude)
            } else {
              app.debug(pathValue.value)
            }
          }) // update.values.forEach
        }) // delta.updates.forEach
        app.debug('-------------------')
      }


    }) // app.registerDeltaInputHandler

  };  // plugin.start



  plugin.stop = function () {
    app.debug('Plugin stopped');
  };



  plugin.schema = {
    type: 'object',
    required: ['sendOutlierPath', 'threshold_depth', 'threshold_STW', 'allowedChange_AWS', 'AWS_maxValue', 'filterPositionZero'],
    properties: {
      sendOutlierPath: {
        type: 'boolean',
        title: 'If outliers are detected, support diagnostics by sending raw delta to <path>_outlier',
        default: true
      },
      threshold_depth: {
        type: 'number',
        title: 'environment.depth.belowTransducer: Depth soundings larger than threshold are filtered out [m]',
        default: 1000
      },   
      threshold_STW: {
        type: 'number',
        title: 'navigation.speedThroughWater: Values larger than threshold are filtered out [kn]',
        default: 100
      },  
      allowedChange_AWS: {
        type: 'number',
        title: 'environment.wind.speedApparent: If compared to the last valid sample a new sample is smaller than the configured percentage, the new sample is filtered out [%]',
        default: 10
      },
      AWS_maxValue: {
        type: 'number',
        title: 'environment.wind.speedApparent: Maximum plausible wind speed, values above are filtered out [kn]',
        default: 150
      },
      filterPositionZero: {
        type: 'boolean',
        title: 'navigation.position:  While the position is always filtered for NaN, this toggle activates filtering out position samples that contain [0.0,0.0]. If corrupt, the complete delta from GPS is dropped',
        default: true
      }
    }
  };

  return plugin;
};
