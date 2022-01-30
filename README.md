# signalk-detect-outliers

This plugin filters the incoming delta stream for certain, pertinent issues with data coming in from proprietary sensors.

Certain sensors tend to occasionally send corrupt data samples (e.g. depth sounders, paddle logs, wind speed sensors, GPS). Examples for such corrupt data samples are reported depths of a few thousand meters, huge values for speed through water, same for apparent wind speed where also samples close to zero are observed regularly. For data from GSP sensors, corrupt samples contain e.g. NaN or null for the position. Also, a position of [0.0, 0.0] as sometimes reported during startup of a GPS unit is not considered as valid position.

This plugin observes the data stream flowing in from proprietary sensors to the signalk server and checks for these typical irregularities.

If detected, the respective delta is not send to the server. Instead, the respective path is set to 'null' and (if activated) the delta is routed to a new path '<path>_outlier' to support diagnostics.

During the development of this plugin recent Raymarine hardware was used. Depending on the actual hardware on other boats, the character of the corrupt data may change. Here the plugin may require some adaptation to the specifics of other sensors.

Currently the followings features are implemented:

  - environment.depth.belowTransducer: Depth soundings larger than configured threshold are filtered out [m]
  - navigation.speedThroughWater: Values larger than configured threshold are filtered out [kn]
  - environment.wind.speedApparent: If compared to the last valid sample a new sample is smaller than the configured percentage, the new sample is filtered out [%]. Also, a maximum reasonable wind speed can be configured.
  - navigation.position: Drop position samples that 'NaN' and (if activated) contain a position [0.0,0.0]. 

