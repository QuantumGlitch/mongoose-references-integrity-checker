# Package: mongoose-references-integrity-checker

Package useful for mantaining the references integrity and structure of mongoose models.
It provides cascade deleting, and ref support at any nested level.
Also include support for soft deleting.

**N.B:**
This is based on middleware hook **remove** and **deleteOne** of mongoose. If you would like to mantain the integrity anyway, you should always use this middleware even on a bunch of data (obviously at the cost of performance) by looping over the collection and deleting singularly every document.

If you are interested in the integrity of sub references too, (watch this out)[https://github.com/QuantumGlitch/mongoose-sub-references-integrity-checker].

# Dependencies

Mongoose >= 5.10.7,
MongoDB >= 3.6

# Install

For this package :

```shell
npm i mongoose-references-integrity-checker
```

If you would like to integrate it with soft deleting:

```shell
npm i mongoose-references-integrity-checker mongoose-soft-deleting
```

# Setup

For setting up the integrity checker on a mongoose schema, you have two options:

1.

```js
const referencesIntegrityChecker = require('mongoose-references-integrity-checker');

const TestSchema = new mongoose.Schema({});
referencesIntegrityChecker('Test', TestSchema);
const TestModel = mongoose.model('Test', TestSchema);
```

2.

```js
const { consistentModel } = require('mongoose-references-integrity-checker');

const TestSchema = new mongoose.Schema({});
const TestModel = consistentModel('Test', TestSchema);
```

# Concepts

## Reference States

A reference could stay in three possible states:

- **Required**
  ( Deleting the parent of the relationship will throw an error )
- **Required and Cascade**
  ( Deleting the parent of the relationship will delete all of his children )
- **Not required**
  ( Deleting the parent will unset the ref on all of his children )

### Required

Setting up the models in this way :

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');

// House - 1
const HouseSchema = new mongoose.Schema({});
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Only required
    required: true,
  },
});
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and child
const parent = await new HouseModel().save();
const child = await new RoomModel({ house: parent._id }).save();

try{
// Try delete
await parent.deleteOne();
}catch(e){
    assert(e instanceof RefConstraintError);
}

```

Would lead in the situation in which when you delete the parent on the relationship (e.g. House) then will be thrown a RefConstraintError.

The reference is required on the child of the relationship, so you can't delete the parent without unsetting the reference first.

### Required and Cascade

Consider this situation:

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');

// House - 1
const HouseSchema = new mongoose.Schema({});
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Required and cascade
    required: true,
    cascade: true
  },
});
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and children
const parent = await new HouseModel().save();
const child0 = await new RoomModel({ house: parent._id }).save();
const child1 = await new RoomModel({ house: parent._id }).save();

// Delete
await parent.deleteOne();

// All deleted
assert(!await HouseModel.findById(parent._id));
assert(!await RoomModel.findById(child0._id));
assert(!await RoomModel.findById(child1._id));

```

Deleting the parent of the relationship will delete all his children.

### Not Required

This is the last use case :

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');

// House - 1
const HouseSchema = new mongoose.Schema({});
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Not required
    required: false,
  },
});
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and child
const parent = await new HouseModel().save();
const child = await new RoomModel({ house: parent._id }).save();

await parent.deleteOne();

// Ref on child will be null
assert(!child.house);
```

If the reference is not required then deleting the parent of the relationship will unset the ref on all his children.

## Nesting

In the last examples we've seen the most simple case, in which the ref on the child is in the root of the document. Any way you can nest it in the way you prefer and the usage will be the same.

```js
const RoomSchema = new mongoose.Schema({
  pathToRef: {
    ...
        {
            anyProp: [
                ...
                    propertyIfYouWant: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'House',
                        ... (refOptions)
                    }
                ...
            ]
        }
    ...
  },
});
```

## Soft Delete

Optionally you can combine the usage of the library [mongoose-soft-deleting](https://github.com/QuantumGlitch/mongoose-soft-delete#readme) with this package.

The behaviour in this case will be about the same with some differences.

### Required

If you try to soft delete the parent of the relationship, then will be thrown the same RefConstraintError as before.

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');
const softDeletePlugin = require('mongoose-soft-deleting');

// House - 1
const HouseSchema = new mongoose.Schema({});
HouseSchema.plugin(softDeletePlugin);
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Only required
    required: true,
  },
});
RoomSchema.plugin(softDeletePlugin);
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and child
const parent = await new HouseModel().save();
const child = await new RoomModel({ house: parent._id }).save();

try{
  // Try soft delete
  await parent.softDelete(true);
}catch(e){
    assert(e instanceof RefConstraintError);
}

```

### Required and cascade

If you try to soft delete or restore the parent of the relationship then all his children will have the same fate.

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');
const softDeletePlugin = require('mongoose-soft-deleting');

// House - 1
const HouseSchema = new mongoose.Schema({});
HouseSchema.plugin(softDeletePlugin);
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Required and cascade
    required: true,
    cascade: true
  },
});
RoomSchema.plugin(softDeletePlugin);
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and children
const parent = await new HouseModel().save();
const child0 = await new RoomModel({ house: parent._id }).save();
const child1 = await new RoomModel({ house: parent._id }).save();

// Delete
await parent.softDelete(true);

// All soft deleted
assert((await HouseModel.findById(parent._id)).isSoftDeleted());
assert((await RoomModel.findById(child0._id)).isSoftDeleted());
assert((await RoomModel.findById(child1._id)).isSoftDeleted());

// Restore
await parent.softDelete(false);

// All restored
assert(!((await HouseModel.findById(parent._id)).isSoftDeleted()));
assert(!((await RoomModel.findById(child0._id)).isSoftDeleted()));
assert(!((await RoomModel.findById(child1._id)).isSoftDeleted()));

```

### Not required

If you try to soft delete the parent of the relationship then only the parent will be soft deleted. The child will still have his reference set to the parent (because even if the parent is soft deleted, it still exists).

```js
const { consistentModel, RefConstraintError } = require('mongoose-references-integrity-checker');
const softDeletePlugin = require('mongoose-soft-deleting');

// House - 1
const HouseSchema = new mongoose.Schema({});
HouseSchema.plugin(softDeletePlugin);
const HouseModel = consistentModel('House', HouseSchema);

// Room - N
const RoomSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    // Not required
    required: false,
  },
});
RoomSchema.plugin(softDeletePlugin);
const RoomModel = consistentModel('Room', RoomSchema);

...

// Setup parent and child
const parent = await new HouseModel().save();
const child = await new RoomModel({ house: parent._id }).save();

await parent.deleteOne();

// Ref on child will be the same
assert(child.house.equals(parent._id));
```

# Test

You can try the tests using the following command ( before you need to change the connection to MongoDB ) :
`npm run test`

# Support

If you would like to support my work, [please buy me a coffe ☕](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HRVBJMSU9CQXW).
Thanks in advice.
