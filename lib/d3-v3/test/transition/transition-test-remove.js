var assert = require("../assert");

module.exports = {
  "on a new transition": {
    topic: function(d3) {
      var callback = this.callback,
          t = d3.select("body").append("div").transition().remove();
      t.each("end", function() {
        process.nextTick(function() {
          callback(null, t);
        });
      });
    },
    "removes the selected elements": function(transition) {
      assert.domEqual(transition[0][0].parentNode, null);
    }
  },

  "when the element is already removed": {
    topic: function(d3) {
      var callback = this.callback,
          t = d3.select("body").append("div").remove().transition().remove();
      t.each("end", function() {
        process.nextTick(function() {
          callback(null, t);
        });
      });
    },
    "does nothing": function(transition) {
      assert.domEqual(transition[0][0].parentNode, null);
    }
  },

  // Since these tests are triggered inside the end event of the above topic,
  // transitions will inherit ids from the original transition. But we want to
  // test concurrent transitions, so we use timeouts to avoid inheritance. This
  // test also verifies that if multiple transitions are created at the same
  // time, the last transition becomes the owner.

  "when another transition is scheduled": {
    topic: function(d3) {
      var callback = this.callback,
          s = d3.select("body").append("div");
      setTimeout(function() {
        s.transition().duration(150).remove().each("end", function() {
          process.nextTick(function() {
            callback(null, s);
          });
        });
        s.transition().delay(250);
      }, 10);
    },
    "does nothing": function(selection) {
      assert.equal(selection[0][0].parentNode.tagName, "BODY");
    }
  },

  "when a delayed transition has been preempted": {
    "topic": function(d3) {
      var callback = this.callback,
          s = d3.select("body").append("div");
      s.transition().delay(1000);
      s.transition().duration(50).remove();
      setTimeout(function() {
        callback(null, s);
      }, 100);
    },
    "the element is still removed": function(selection) {
      assert.domEqual(selection[0][0].parentNode, null);
    }
  }
};
