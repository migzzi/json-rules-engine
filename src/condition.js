'use strict'

import debug from './debug'
import isObjectLike from 'lodash.isobjectlike'
import { BOOLEAN_OPERATORS } from './constants'

export default class Condition {
  constructor(properties) {
    if (!properties) throw new Error('Condition: constructor options required')

    if (Object.hasOwnProperty.call(properties, 'if')) {
      if (!Object.hasOwnProperty.call(properties, 'then')) {
        throw new Error(`conditional "if" must have accompanying "then" block`)
      }
      if (Array.isArray(properties.if) || Array.isArray(properties.then)) {
        throw new Error('"if" / "then" values must be objects')
      }
      properties = {
        any: [
          { all: [properties.if, properties.then] },
          { not: { ...properties.if } }
        ]
      }
    }

    const booleanOperator = Condition.booleanOperator(properties)
    Object.assign(this, properties)
    if (booleanOperator) {
      let subConditions = properties[booleanOperator]
      if (booleanOperator === 'not') {
        if (Array.isArray(subConditions)) 
          throw new Error(`"${booleanOperator}" must be an object`)
      }
      if (booleanOperator !== 'not' && !Array.isArray(subConditions)) {
        throw new Error(`"${booleanOperator}" must be an array`)
      }
      this.operator = booleanOperator
      // boolean conditions always have a priority default 1
      this.priority = parseInt(properties.priority, 10) || 1
      this[booleanOperator] = booleanOperator === 'not' ? new Condition(subConditions) : subConditions.map((c) => {
        return new Condition(c)
      })
    } else {
      if (!Object.prototype.hasOwnProperty.call(properties, 'fact'))
        throw new Error('Condition: constructor "fact" property required')
      if (!Object.prototype.hasOwnProperty.call(properties, 'operator'))
        throw new Error('Condition: constructor "operator" property required')
      if (!Object.prototype.hasOwnProperty.call(properties, 'value'))
        throw new Error('Condition: constructor "value" property required')

      // a non-boolean condition does not have a priority by default. this allows
      // priority to be dictated by the fact definition
      if (Object.prototype.hasOwnProperty.call(properties, 'priority')) {
        properties.priority = parseInt(properties.priority, 10)
      }
    }
  }

  /**
   * Converts the condition into a json-friendly structure
   * @param   {Boolean} stringify - whether to return as a json string
   * @returns {string,object} json string or json-friendly object
   */
  toJSON(stringify = true) {
    const props = {}
    if (this.priority) {
      props.priority = this.priority
    }
    const oper = Condition.booleanOperator(this)
    if (oper) {
      props[oper] = this[oper].map((c) => c.toJSON(stringify))
    } else {
      props.operator = this.operator
      props.value = this.value
      props.fact = this.fact
      if (this.factResult !== undefined) {
        props.factResult = this.factResult
      }
      if (this.result !== undefined) {
        props.result = this.result
      }
      if (this.params) {
        props.params = this.params
      }
      if (this.path) {
        props.path = this.path
      }
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  /**
   * Apply the given set of pipes to the given value.
   */
  _evalPipes(value, pipes, pipeMap) {
    if (!Array.isArray(pipes))
      return Promise.reject(new Error('pipes must be an array'))
    if (!pipeMap) return Promise.reject(new Error('pipeMap required'))

    let currValue = value
    for (const pipeObj of pipes) {
      const pipe = pipeMap.get(pipeObj.name)
      if (!pipe)
        return Promise.reject(new Error(`Unknown pipe: ${pipeObj.name}`))
      currValue = pipe.evaluate(currValue, ...(pipeObj.args || []))
    }

    return currValue
  }

  /**
   * Interprets .value as either a primitive, or if a fact, retrieves the fact value
   */
  _getValue(almanac, pipeMap) {
    const value = this.value
    if (
      isObjectLike(value) &&
      Object.prototype.hasOwnProperty.call(value, 'fact')
    ) {
      // value: { fact: 'xyz' }
      return almanac
        .factValue(value.fact, value.params, value.path)
        .then((factValue) =>
          value.pipes
            ? this._evalPipes(factValue, value.pipes, pipeMap)
            : factValue
        )
    }
    return Promise.resolve(value)
  }

  /**
   * Takes the fact result and compares it to the condition 'value', using the operator
   *   LHS                      OPER       RHS
   * <fact + params + path>  <operator>  <value>
   *
   * @param   {Almanac} almanac
   * @param   {Map} operatorMap - map of available operators, keyed by operator name
   * @param   {Map} pipeMap - map of available pipes, keyed by pipe name
   * @returns {Boolean} - evaluation result
   */
  evaluate(almanac, operatorMap, pipeMap) {
    if (!almanac) return Promise.reject(new Error('almanac required'))
    if (!operatorMap) return Promise.reject(new Error('operatorMap required'))
    if (!pipeMap && this.pipes && this.pipes.length)
      return Promise.reject(new Error('pipeMap required'))
    if (this.isBooleanOperator())
      return Promise.reject(new Error('Cannot evaluate() a boolean condition'))

    let invertedOp = false, operator = this.operator
    if (isObjectLike(operator) && Object.prototype.hasOwnProperty.call(operator, 'not')) {
      invertedOp = true
      operator = operator.not
    }
    const op = operatorMap.get(operator)
    if (!op)
      return Promise.reject(new Error(`Unknown operator: ${operator}`))

    return this._getValue(almanac, pipeMap) // todo - parallelize
      .then((rightHandSideValue) => {
        return almanac
          .factValue(this.fact, this.params, this.path)
          .then((leftHandSideValue) =>
            this.pipes
              ? this._evalPipes(leftHandSideValue, this.pipes, pipeMap)
              : leftHandSideValue
          )
          .then((leftHandSideValue) => {
            let result = op.evaluate(leftHandSideValue, rightHandSideValue)
            result = invertedOp ? !result : result
            debug(
              `condition::evaluate <${JSON.stringify(leftHandSideValue)} ${invertedOp ? 'NOT ' : ''}${
                operator
              } ${JSON.stringify(rightHandSideValue)}?> (${result})`
            )
            return {
              result,
              leftHandSideValue,
              rightHandSideValue,
              operator: this.operator,
            }
          })
      })
  }

  /**
   * Returns the boolean operator for the condition
   * If the condition is not a boolean condition, the result will be 'undefined'
   * @return {string 'all' or 'any' or 'not'}
   */
  static booleanOperator(condition) {
    return BOOLEAN_OPERATORS.find((bo) => Object.prototype.hasOwnProperty.call(condition, bo))
  }

  /**
   * Returns the condition's boolean operator
   * Instance version of Condition.isBooleanOperator
   * @returns {string,undefined} - 'any', 'all', 'not', or undefined (if not a boolean condition)
   */
  booleanOperator() {
    return Condition.booleanOperator(this)
  }

  /**
   * Whether the operator is boolean ('all', 'any', 'not')
   * @returns {Boolean}
   */
  isBooleanOperator() {
    return Condition.booleanOperator(this) !== undefined
  }



  /**
   * Returns a set of used facts in a condition
   * @returns {Set}
   */
  getUsedFacts() {
    const facts = new Set()
    if (this.isBooleanOperator()) {
      this[this.operator].forEach((c) => {
        const subFacts = c.getUsedFacts()
        if(subFacts.size) {
          subFacts.forEach((sf) => facts.add(sf))
        }
      })
    } else {
      facts.add(this.fact)
      if (isObjectLike(this.value) && Object.prototype.hasOwnProperty.call(this.value, 'fact')) {
        facts.add(this.value.fact)
      }
    }
    return facts
  }
}
