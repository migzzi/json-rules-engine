'use strict'

import sinon from 'sinon'
import engineFactory from '../src/index'

describe('Engine: "not" conditions', () => {
  let engine
  let sandbox
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })

  describe('supports a "not" with single inner condition', () => {
    const event = {
      type: 'ageTrigger',
      params: {
        demographic: 'under50'
      }
    }
    const conditions = {
      not: {
        fact: 'age',
        operator: 'lessThan',
        value: 50
      }
    }
    let eventSpy
    let ageSpy
    beforeEach(() => {
      eventSpy = sandbox.spy()
      ageSpy = sandbox.stub()
      const rule = factories.rule({ conditions, event })
      engine = engineFactory()
      engine.addRule(rule)
      engine.addFact('age', ageSpy)
      engine.on('success', eventSpy)
    })

    it('does not emit when the inner condition is met', async () => {
      ageSpy.returns(10)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)
    })

    it('emits when the inner condition fails', async () => {
      ageSpy.returns(75)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
    })
  })

  describe('supports a nested "not" with single inner condition', () => {
    const event = {
      type: 'ageTrigger',
      params: {
        demographic: 'under50'
      }
    }
    const conditions = {
      not: {
        not: {
          fact: 'age',
          operator: 'lessThan',
          value: 50
        }
      }
    }
    let eventSpy
    let ageSpy
    beforeEach(() => {
      eventSpy = sandbox.spy()
      ageSpy = sandbox.stub()
      const rule = factories.rule({ conditions, event })
      engine = engineFactory()
      engine.addRule(rule)
      engine.addFact('age', ageSpy)
      engine.on('success', eventSpy)
    })

    it('emits when the inner condition is met', async () => {
      ageSpy.returns(10)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
    })

    it('does not emit when the inner condition fails', async () => {
      ageSpy.returns(75)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)
    })
  })

  describe('supports "not" with "any" inner conditions', () => {
    const conditions = {
      not: {
        any: [{
          fact: 'age',
          operator: 'lessThan',
          value: 50
        }, {
          fact: 'segment',
          operator: 'equal',
          value: 'european'
        }]
      }
    }
    const event = {
      type: 'ageTrigger',
      params: {
        demographic: 'under50'
      }
    }
    let eventSpy
    let ageSpy
    let segmentSpy
    beforeEach(() => {
      eventSpy = sandbox.spy()
      ageSpy = sandbox.stub()
      segmentSpy = sandbox.stub()
      const rule = factories.rule({ conditions, event })
      engine = engineFactory()
      engine.addRule(rule)
      engine.addFact('segment', segmentSpy)
      engine.addFact('age', ageSpy)
      engine.on('success', eventSpy)
    })

    it('does not emit an event when any condition is met', async () => {
      segmentSpy.returns('north-american')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)
    })

    it('emits when all conditions fail', async () => {
      segmentSpy.returns('north-american')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
    })
  })

  describe('supports "not" with "all" inner conditions', () => {
    const conditions = {
      not: {
        all: [{
          fact: 'age',
          operator: 'lessThan',
          value: 50
        }, {
          fact: 'segment',
          operator: 'equal',
          value: 'european'
        }]
      }
    }
    const event = {
      type: 'ageTrigger',
      params: {
        demographic: 'under50'
      }
    }
    let eventSpy
    let ageSpy
    let segmentSpy
    beforeEach(() => {
      eventSpy = sandbox.spy()
      ageSpy = sandbox.stub()
      segmentSpy = sandbox.stub()
      const rule = factories.rule({ conditions, event })
      engine = engineFactory()
      engine.addRule(rule)
      engine.addFact('segment', segmentSpy)
      engine.addFact('age', ageSpy)
      engine.on('success', eventSpy)
    })

    it('emits an event when any condition is not met', async () => {
      segmentSpy.returns('north-american')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)

      segmentSpy.returns('north-american')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
    })

    it('does not emit when all conditions succeeds', async () => {
      segmentSpy.returns('european')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)
    })
  })

})
