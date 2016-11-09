
var BE_TESTS = [];

/*
	A test object that holds state. Push these into BE_TESTS and use runBeTests() to run them.
*/
class BeTest {
	constructor(name, testFunction){
		this.name = typeof name === undefined ? "Unnamed test" : name;
		this.testFunction = testFunction
	}
	test() {
		try {
			this.testFunction(this);
			return true;
		} catch (e) {
			console.error("Error", e, e.stack);
			return false;
		}
	}
	assertTrue(value){
		if(!value){
			throw new Error(`${value} is not true`);
		}
	}
	assertInstanceOf(value, clazz){
		if(value instanceof clazz){
			return;
		}
		throw new Error(`${value} is not an instance of ${clazz}`);
	}
	assertNull(value){
		if(value !== null){
			throw new Error(`${value} is not null`);
		}
	}
	assertEqual(val1, val2){
		if(typeof val1 == "undefined"){
			return typeof val2 == "undefined";
		}
		if(typeof val2 == "undefined"){
			return typeof val2 == "undefined";
		}
		if(typeof val1.equals == "function"){
			if(val1.equals(val2) == false){
				throw new Error(`${val1} != ${val2}`)
			}
		}
		else if(val1 != val2){
			throw new Error(`${val1} != ${val2}`)
		}
	}
}

/*
	Run the tests in BE_TESTS
*/
function runBeTests(){
	let passedTests = [];
	let failedTests = [];
	for(let test of BE_TESTS){
		let passed = test.test();
		if(passed){
			passedTests.push(test);
		} else {
			failedTests.push(test);
		}
	}
	return [passedTests, failedTests];
}

/*
	Run BE_TESTS and print results to the console
*/
function runAndLogBeTests(){
	var [passedTests, failedTests] = runBeTests();
	console.log(`Tests: total: ${passedTests.length + failedTests.length} passed: ${passedTests.length} failed: ${failedTests.length}`);
}

/*
	Run the tests for Be itself, including testing DataModel and DataCollection
*/
function testBe(){
	BE_TESTS.push(new BeTest("Events test", (test) => {
		let model = new DataModel();
		let receivedEvents = [];
		model.addListener("all", (eventName, target, ...params) => { 
			receivedEvents.push({ eventName: eventName, target: target, params: params });
		});
		model.addListener("change:foo", (eventName, target, ...params) => { 
			receivedEvents.push({ eventName: eventName, target: target, params: params });
		});
		model.addListener("change:not_foo", (eventName, target, ...params) => { 
			receivedEvents.push({ eventName: eventName, target: target, params: params });
		});
		model.trigger("change:foo", model, "foo");
		test.assertEqual(receivedEvents.length, 2);
		test.assertEqual(receivedEvents[receivedEvents.length - 1].eventName, "change:foo");
		test.assertEqual(receivedEvents[receivedEvents.length - 1].target, model);
		test.assertEqual(receivedEvents[receivedEvents.length - 1].params[0], "foo");

		model.cleanup();
		let numEvents = receivedEvents.length;
		model.trigger("change:foo", model, "foo");
		test.assertEqual(receivedEvents.length, numEvents);
	}));
	BE_TESTS.push(new BeTest("Model events", (test) => {
		let receivedEvents = [];
		class FlowersCollection extends DataCollection {}
		let model = new DataModel(null, {
			fieldModels: { flowers: FlowersCollection }
		});
		model.addListener("all", (eventName, target, ...params) => { 
			receivedEvents.push({ eventName: eventName, target: target, params: params });
		});
		test.assertNull(model.get("bogus"));
		test.assertEqual(model.get("bogus", "moon"), "moon");
		model.set("moon", "unit");
		test.assertEqual(model.get("moon"), "unit");
		test.assertEqual(model.get("moon", "goon"), "unit");
		test.assertEqual(receivedEvents.length, 2);
		test.assertEqual(receivedEvents[0].eventName, "change:moon");
		test.assertEqual(receivedEvents[1].eventName, "change");
		model.setBatch({
			"dink": "donk",
			"pink": "punk"
		});
		test.assertEqual(model.get("dink"), "donk");
		test.assertEqual(model.get("pink"), "punk");
		test.assertEqual(receivedEvents.length, 5);
		test.assertEqual(receivedEvents[2].eventName, "change:dink");
		test.assertEqual(receivedEvents[3].eventName, "change:pink");
		test.assertEqual(receivedEvents[4].eventName, "change");
		model.set("dink", "donk");
		test.assertEqual(receivedEvents.length, 5); // Set to same value, should trigger no events

		model.set("flowers", [{ petals: 5 }, { petals: 6 }]);
		test.assertInstanceOf(model.get("flowers"), FlowersCollection);
		let flowerCount = 0;
		for(flower of model.get("flowers")){
			flowerCount++;
		}
		test.assertEqual(flowerCount, 2);
	}));
	BE_TESTS.push(new BeTest("Model extension", (test) => {
		class ChildModel extends DataModel {
			get url(){
				return "/api/0.1.0/schema";
			}
		}
		var child = new ChildModel();
		child.fetch();
	}));

	runAndLogBeTests();
}
