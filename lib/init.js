var Veronica,
    Blast;

// Get an existing Protoblast instance,
// or create a new one
if (typeof __Protoblast != 'undefined') {
	Blast = __Protoblast;
} else {
	Blast = require('protoblast')(false);
}

// Get the Veronica namespace
Veronica = Blast.Bound.Function.getNamespace('Develry.Veronica');

require('./veronica.js');

// Export the Veronica namespace
module.exports = Blast.Classes.Develry.Veronica;