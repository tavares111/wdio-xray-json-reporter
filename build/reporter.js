'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

/**
 * Initialize a new `Json` test reporter.
 *
 * @param {Runner} runner
 * @api public
 */

var JsonReporter = (function (_events$EventEmitter) {
	_inherits(JsonReporter, _events$EventEmitter);

	function JsonReporter(baseReporter, config, options) {
		var _this = this;

		_classCallCheck(this, JsonReporter);

		_get(Object.getPrototypeOf(JsonReporter.prototype), 'constructor', this).call(this);

		this.baseReporter = baseReporter;
		this.config = config;
		this.options = options || {};

		var inputFormatStr = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
		var outputFormatStr = 'YYYY-MM-DDTHH:mm:ssZ';

		var suitesUIDMap = {};
		var suites = [];
		var testExecutionKey = undefined;
		var testKeyTagIndex = undefined;
		var testKey = undefined;
		this.on('suite:start', function (event) {
			var xrayId = event.file.slice(event.file.lastIndexOf('\\') + 1).replace('.feature', '');

			if (xrayId) {
				var data = suitesUIDMap[event.uid];
				if (typeof data === 'undefined' || data === null) {
					data = {
						xrayId: xrayId
					};

					if (event.parent === null) {
						// This is the feature
						var ids = suites.map(function (s) {
							return s.xrayId;
						});
						if (ids.indexOf(xrayId) < 0) {
							testExecutionKey = event.tags[0].name.replace('@', '');
							testKeyTagIndex = event.tags.length;
							data.scenarios = [];
							suites.push(data);
						}
					} else {
						// This is a scenario in a feature
						data.steps = {};
						testKey = event.tags[testKeyTagIndex].name.replace('@', '');
						var _parent = suitesUIDMap[event.parent];
						if (_parent) {
							_parent.scenarios.push(data);
						}
					}

					suitesUIDMap[event.uid] = data;
				}
			}
		});

		this.on('test:pass', function (event) {
			var suite = suitesUIDMap[event.parent];
			var envSteps = suite.steps[event.cid];
			if (typeof envSteps === 'undefined' || envSteps === null) {
				envSteps = [];
				suite.steps[event.cid] = envSteps;
			}

			envSteps.push({
				status: 'PASS',
				comment: event.title

			});
		});

		// TODO
		//evidences: []
		this.on('test:fail', function (event) {
			var suite = suitesUIDMap[event.parent];

			var comment = event.title;
			comment += '\r\n';
			if (event.err.message) {
				comment += event.err.message;
				comment += '\r\n';
			}
			if (event.err.stack) {
				comment += event.err.stack;
				comment += '\r\n';
			}

			var envSteps = suite.steps[event.cid];
			if (typeof envSteps === 'undefined' || envSteps === null) {
				envSteps = [];
				suite.steps[event.cid] = envSteps;
			}

			envSteps.push({
				status: 'FAIL',
				comment: comment

			});
		});

		// TODO
		//evidences: []
		this.on('test:pending', function (event) {
			var suite = suitesUIDMap[event.parent];

			var comment = event.title;
			comment += '\r\n';
			if (event.err.message) {
				comment += event.err.message;
				comment += '\r\n';
			}
			if (event.err.stack) {
				comment += event.err.stack;
				comment += '\r\n';
			}

			var envSteps = suite.steps[event.cid];
			if (typeof envSteps === 'undefined' || envSteps === null) {
				envSteps = [];
				suite.steps[event.cid] = envSteps;
			}

			envSteps.push({
				status: 'FAIL',
				comment: comment

			});
		});

		// TODO
		//evidences: []
		this.on('end', function () {
			var start = (0, _moment2['default'])(_this.baseReporter.stats.start, inputFormatStr);
			var end = (0, _moment2['default'])(_this.baseReporter.stats.end, inputFormatStr);
			var envToBrowserMap = {};
			var browserToEnvMap = {};

			_Object$keys(_this.baseReporter.stats.runners).forEach(function (key) {
				var browser = _this.baseReporter.stats.runners[key].sanitizedCapabilities;
				envToBrowserMap[key] = browser;
				var envs = browserToEnvMap[browser];
				if (typeof envs === 'undefined' || envs === null) {
					envs = [];
					browserToEnvMap[browser] = envs;
				}
				envs.push(key);
			});

			var results = _Object$keys(browserToEnvMap).map(function (browser) {
				var tests = suites.reduce(function (allTests, suite) {
					var tests = suite.scenarios.reduce(function (result, current) {
						var steps = browserToEnvMap[browser].reduce(function (steps, env) {
							if (current.steps[env]) {
								return steps.concat(current.steps[env]);
							}
							return steps;
						}, []);

						var status = steps.reduce(function (resultStatus, currentStep) {
							if (resultStatus === 'FAIL') {
								return resultStatus;
							}

							if (currentStep.status === 'FAIL') {
								return 'FAIL';
							}

							return resultStatus;
						}, 'PASS');

						// This sucks, but Xray isn't displaying step info
						// for automated tests yet, I have opened an issue
						// to add this feature, until then we add all the info
						// to the suites comment so that we can still debug
						// failing test steps
						var comment = steps.reduce(function (comment, currentStep) {
							if (currentStep.status === 'FAIL') {
								comment += currentStep.comment;
								comment += '\r\n';
							}

							return comment;
						}, '');

						return result.concat({
							testKey: testKey,
							start: start.format(outputFormatStr),
							finish: end.format(outputFormatStr),
							status: status,
							steps: steps,
							examples: [status],
							comment: comment

							// TODO
							//evidences: []
							//results: []
						});
					}, []);

					return allTests.concat(tests);
				}, []);

				var dedupedTestIds = {};
				var dedupedTests = [];
				tests.forEach(function (test) {
					if (dedupedTestIds[test.testKey]) {
						// This test was duplicated, this means it
						// was the result of an examples table
						var existing = dedupedTestIds[test.testKey];
						// Add the current tests result to the existing examples
						existing.examples.push(test.status);
						// Add the current tests comment to the existing comment
						if (test.comment.length > 0) {
							existing.comment += '\r\n';
							existing.comment += test.comment;
						}

						return;
					}

					dedupedTestIds[test.testKey] = test;
					dedupedTests.push(test);
				});

				var result = {
					testExecutionKey: testExecutionKey,
					info: {
						summary: 'Execution of test plan: ' + _this.options.testPlanKey + ' Browser: ' + browser,
						startDate: start.format(outputFormatStr),
						finishDate: end.format(outputFormatStr),
						testPlanKey: _this.options.testPlanKey,
						testEnvironments: [browser]
					},
					tests: dedupedTests
				};

				if (_this.options.revision) {
					result.info.revision = _this.options.revision;
				}

				if (_this.options.version) {
					result.info.version = _this.options.version;
				}

				if (_this.options.user) {
					result.info.user = _this.options.user;
				}

				if (_this.options.project) {
					result.info.project = _this.options.project;
				}

				return result;
			});

			_this.write(results);
		});
	}

	_createClass(JsonReporter, [{
		key: 'write',
		value: function write(json) {
			if (!this.options || typeof this.options.outputDir !== 'string') {
				return console.log('Cannot write json report: empty or invalid \'outputDir\'.');
			}

			try {
				var dir = _path2['default'].resolve(this.options.outputDir);
				var filename = 'WDIO.xray.json.' + _uuid2['default'].v1() + '.json';
				var filepath = _path2['default'].join(dir, filename);
				_mkdirp2['default'].sync(dir);
				_fs2['default'].writeFileSync(filepath, JSON.stringify(json));
				console.log('Wrote json report to [' + this.options.outputDir + '].');
			} catch (e) {
				console.log('Failed to write json report to [' + this.options.outputDir + ']. Error: ' + e);
			}
		}
	}, {
		key: 'format',
		value: function format(val) {
			return JSON.stringify(this.baseReporter.limit(val));
		}
	}]);

	return JsonReporter;
})(_events2['default'].EventEmitter);

exports['default'] = JsonReporter;
module.exports = exports['default'];
