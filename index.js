const mongoose = require.main.require('mongoose');
const RefConstraintError = require('./error');

const refs = {};

function getFindQueryObjectFor(modelRef, pathRef, referencedId) {
  return {
    [pathRef]: referencedId,
  };
}

function getUpdateQueryObjectFor(modelRef, pathRef, referencedId) {
  const path = pathRef instanceof Array ? pathRef : pathRef.split('.');
  const model = mongoose.model(modelRef);
  const fieldRefSchemaType = model.schema.path(pathRef);
  const result = [];
  const info = [];
  let lastDocumentArray = null;

  // Build info for updating
  for (let i = 0; i < path.length - 1; i++) {
    const absolutePath = path.filter((_, i2) => i2 <= i);
    const schemaType = model.schema.path(absolutePath.join('.'));

    if (schemaType && schemaType.constructor.name === 'DocumentArrayPath') {
      // Is an array
      lastDocumentArray = i;
      info.push({ array: true });
      continue;
    }

    info.push({});
  }

  let updatePath = '';
  let arrayFilterConditionPath = '';

  // Build path for update query
  for (let i = 0; i < info.length; i++) {
    updatePath +=
      path[i] + '.' + (info[i].array ? (i === lastDocumentArray ? '$[j].' : '$[].') : '');

    if (lastDocumentArray !== null && i > lastDocumentArray)
      arrayFilterConditionPath += path[i] + '.';
  }

  // add last element of the path
  updatePath += path[path.length - 1];
  arrayFilterConditionPath += path[path.length - 1];

  // fieldRefSchemaType is the last schemaType of the path
  // If it is array of refs then use pull else set (remove from the array the ref or set null the ref)
  const operator = fieldRefSchemaType.constructor.name === 'SchemaArray' ? '$pull' : '$set';

  // Update
  result.push({
    [operator]: {
      [updatePath]: operator === '$pull' ? referencedId : null,
    },
  });

  // Update options
  // If we have found at the least one document array
  if (lastDocumentArray !== null)
    result.push({
      arrayFilters: [{ [`j.${arrayFilterConditionPath}`]: referencedId }],
    });

  return result;
}

function plugin(modelName, schema) {
  if (!refs[modelName]) refs[modelName] = [];

  function eachPath(path, schemaType) {
    // Array of primitives
    if (schemaType.constructor.name === 'SchemaArray' && schemaType.options.type[0].ref) {
      refs[schemaType.options.type[0].ref] = [
        ...(refs[schemaType.options.ref] || []),
        { modelName, path: path, schemaType: schemaType.options.type[0] },
      ];
    } else if (schemaType.schema) {
      // Array of complex ( Schema )
      if (schemaType.constructor.name === 'DocumentArrayPath')
        schemaType.schema.eachPath((subPath, subSchemaType) =>
          eachPath(path + '.' + subPath, subSchemaType)
        );
      // Object
      else if (schemaType.constructor.name === 'SingleNestedPath')
        schemaType.schema.eachPath((subPath, subSchemaType) =>
          eachPath(path + '.' + subPath, subSchemaType)
        );
    } // Primitive fields or nested object fields
    else if (schemaType.options.ref)
      refs[schemaType.options.ref] = [
        ...(refs[schemaType.options.ref] || []),
        { modelName, path, schemaType },
      ];
  }

  // Search for refs in schema
  schema.eachPath((path, schemaType) => eachPath(path, schemaType));

  async function onDeleteSetNull(
    modelRef,
    pathRef,
    documentId,
    { softDelete = false, _deleted } = {}
  ) {
    if (!softDelete)
      await mongoose
        .model(modelRef)
        .updateMany(
          getFindQueryObjectFor(modelRef, pathRef, documentId),
          ...getUpdateQueryObjectFor(modelRef, pathRef, documentId)
        )
        .exec();
  }

  async function onDeleteCascade(
    modelRef,
    pathRef,
    documentId,
    { softDelete = false, _deleted } = {}
  ) {
    const queryObject = getFindQueryObjectFor(modelRef, pathRef, documentId);

    const documents = await mongoose.model(modelRef).find(queryObject).exec();

    if (softDelete)
      // We need to use the softDelete function to trigger again the hooks for checking references
      await Promise.all(documents.map((doc) => doc.softDelete(_deleted)));
    // We need to use the deleteOne function to trigger again the hooks for checking references
    else await Promise.all(documents.map((doc) => doc.deleteOne()));
  }

  async function onDeleteBlock(
    modelRef,
    pathRef,
    documentId,
    { softDelete = false, _deleted } = {}
  ) {
    if (!softDelete || _deleted) {
      const queryObject = getFindQueryObjectFor(modelRef, pathRef, documentId);
      let constrainedDoc = null;

      if ((constrainedDoc = await mongoose.model(modelRef).findOne(queryObject).exec()))
        // Cannot remove if exists at least one referencing this document
        throw new RefConstraintError({
          modelName,
          modelRef,
          pathRef,
          whoIsBlocking: constrainedDoc._id,
        });
    }
  }

  async function onDelete(documentId, softDeleteOptions) {
    for (let { modelName: modelRef, path, schemaType } of refs[modelName]) {
      if (schemaType.required) {
        // This reference is required
        if (schemaType.cascade || (schemaType.options && schemaType.options.cascade))
          // Delete references on cascade
          await onDeleteCascade(modelRef, path, documentId, softDeleteOptions);
        // Block delete if references exist
        else await onDeleteBlock(modelRef, path, documentId, softDeleteOptions);
      }
      // Not required, we can simply set null the reference
      else await onDeleteSetNull(modelRef, path, documentId, softDeleteOptions);
    }
  }

  // Before remove, check if the removing is possible
  schema.pre('remove', async function () {
    const _id = this._id || this._conditions._id;
    if (_id) await onDelete(_id);
  });

  // Before deleteOne, check if the removing is possible
  schema.pre('deleteOne', async function () {
    const _id = this._id || this._conditions._id;
    if (_id) await onDelete(_id);
  });

  schema.plugin((schema) => {
    // If soft deleting is available
    if (schema.statics.preSoftDelete)
      schema.statics.preSoftDelete(async (document) => {
        try {
          await onDelete(document._id, { softDelete: true, _deleted: document._deleted });
        } catch (e) {
          // Deleting was blocked
          if (e instanceof RefConstraintError)
            // Rollback then
            document._deleted = false;
          throw e;
        }
      });
  });
}

plugin.consistentModel = function (modelName, schema) {
  plugin(modelName, schema);
  return mongoose.model(modelName, schema);
};

plugin.RefConstraintError = RefConstraintError;
module.exports = plugin;
