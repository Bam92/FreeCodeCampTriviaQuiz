/* eslint-disable  func-names */
/* eslint-disable  dot-notation */
/* eslint-disable  new-cap */
/* eslint quote-props: ['error', 'consistent'] */

'use strict'

const Alexa = require('alexa-sdk')

const cssquestions = require('./questions/css')
const javascriptquestions = require('./questions/javascript')
const generalquestions = require('./questions/general')
const randomquestions = require('./questions/random')

const ANSWER_COUNT = 4 // The number of possible answers per trivia question.
const GAME_LENGTH = 10 // The number of questions per trivia game.
let temp = 0 // Added to control flow of the yes Intent
const GAME_STATES = {
  SETUP: '_SETUPMODE', // SET GAME TYPE
  TRIVIA: '_TRIVIAMODE', // Asking trivia questions.
  START: '_STARTMODE', // Entry point, start the game.
  HELP: '_HELPMODE' // The user is asking for help.
}
const APP_ID = undefined // TODO replace with your app ID (OPTIONAL)

/**
 * When editing your questions pay attention to your punctuation. Make sure you use question marks or periods.
 * Make sure the first answer is the correct one. Set at least ANSWER_COUNT answers, any extras will be shuffled in.
 */
const languageString = {
  'en': {
    'translation': {
      'QUESTIONS': randomquestions['QUESTIONS_EN_US'],
      'GAME_NAME': 'Free Code Camp Developer Quiz', // Be sure to change this for your skill.
      'HELP_MESSAGE': 'I will ask you %s multiple choice questions on the subject of your choosing. Respond with the number of the answer. ' +
				'For example, say one, two, three, or four. To start a new game at any time, say, start game. ',
      'REPEAT_QUESTION_MESSAGE': 'To repeat the last question, say, repeat. ',
      'ASK_MESSAGE_START': 'Would you like to start playing?',
      'HELP_REPROMPT': 'To give an answer to a question, respond with the number of the answer. ',
      'STOP_MESSAGE': 'Would you like to keep playing your current game?',
      'CANCEL_MESSAGE': 'Ok, let\'s play again soon.',
      'NO_MESSAGE': 'Ok, we\'ll play another time. Cheerio!',
      'TRIVIA_UNHANDLED': 'Try saying a number between 1 and 4.',
      'HELP_UNHANDLED': 'Say yes to continue, or no to end the game.',
      'START_UNHANDLED': 'Say start to start a new game.',
      'NEW_GAME_MESSAGE': '',
      'WELCOME_MESSAGE': 'I will ask you %s questions on your chosen subject,  see how many you can get right. ' +
				'Just say the number of the answer. Here we go. ',
      'ANSWER_CORRECT_MESSAGE': 'correct. ',
      'ANSWER_WRONG_MESSAGE': 'wrong. sorry, ',
      'CORRECT_ANSWER_MESSAGE': 'The correct answer is %s: %s. ',
      'ANSWER_IS_MESSAGE': 'That answer is ',
      'TELL_QUESTION_MESSAGE': 'Question %s. %s ',
      'GAME_OVER_MESSAGE': 'You answered %s out of %s questions correct. Thank you for playing!, and keep coding!',
      'GAME_OVER_MESSAGE1010': 'You answered %s out of %s questions correct, with no incorrect answers, well done you. Thank you for playing!, and keep coding!',
      'SCORE_IS_MESSAGE': 'Your score is %s. '

    }
  },
  'en-US': {
    'translation': {
      'QUESTIONS': randomquestions['QUESTIONS_EN_US'],
      'GAME_NAME': 'Free Code Camp Developer Quiz' // Be sure to change this for your skill.
    }
  }
}

const newSessionHandlers = {
  'LaunchRequest': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.StartOverIntent': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.HelpIntent': function () {
    this.handler.state = GAME_STATES.HELP
    this.emitWithState('helpTheUser', true)
  },
  'Unhandled': function () {
    const speechOutput = this.t('START_UNHANDLED')
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  }
}

function populateGameQuestions (translatedQuestions) {
  const gameQuestions = []
  const indexList = []
  let index = translatedQuestions.length

  if (GAME_LENGTH > index) {
    throw new Error('Invalid Game Length.')
  }

  for (let i = 0; i < translatedQuestions.length; i++) {
    indexList.push(i)
  }

  // Pick GAME_LENGTH random questions from the list to ask the user, make sure there are no repeats.
  for (let j = 0; j < GAME_LENGTH; j++) {
    const rand = Math.floor(Math.random() * index)
    index -= 1

    const temp = indexList[index]
    indexList[index] = indexList[rand]
    indexList[rand] = temp
    gameQuestions.push(indexList[index])
  }

  return gameQuestions
}

/**
 * Get the answers for a given question, and place the correct answer at the spot marked by the
 * correctAnswerTargetLocation variable. Note that you can have as many answers as you want but
 * only ANSWER_COUNT will be selected.
 * */
function populateRoundAnswers (gameQuestionIndexes, correctAnswerIndex, correctAnswerTargetLocation, translatedQuestions) {
  const answers = []
  const answersCopy = translatedQuestions[gameQuestionIndexes[correctAnswerIndex]][Object.keys(translatedQuestions[gameQuestionIndexes[correctAnswerIndex]])[0]].slice()
  let index = answersCopy.length

  if (index < ANSWER_COUNT) {
    throw new Error('Not enough answers for question.')
  }

  // Shuffle the answers, excluding the first element which is the correct answer.
  for (let j = 1; j < answersCopy.length; j++) {
    const rand = Math.floor(Math.random() * (index - 1)) + 1
    index -= 1

    const swapTemp1 = answersCopy[index]
    answersCopy[index] = answersCopy[rand]
    answersCopy[rand] = swapTemp1
  }

  // Swap the correct answer into the target location
  for (let i = 0; i < ANSWER_COUNT; i++) {
    answers[i] = answersCopy[i]
  }
  const swapTemp2 = answers[0]
  answers[0] = answers[correctAnswerTargetLocation]
  answers[correctAnswerTargetLocation] = swapTemp2
  return answers
}

function isAnswerSlotValid (intent) {
  const answerSlotFilled = intent && intent.slots && intent.slots.Answer && intent.slots.Answer.value
  const answerSlotIsInt = answerSlotFilled && !isNaN(parseInt(intent.slots.Answer.value, 10))
  return answerSlotIsInt &&
		parseInt(intent.slots.Answer.value, 10) < (ANSWER_COUNT + 1) &&
		parseInt(intent.slots.Answer.value, 10) > 0
}

function handleUserGuess (userGaveUp) {
  temp++
  const answerSlotValid = isAnswerSlotValid(this.event.request.intent)
  let speechOutput = ''
  let speechOutputAnalysis = ''
  const gameQuestions = this.attributes.questions
  let correctAnswerIndex = parseInt(this.attributes.correctAnswerIndex, 10)
  let currentScore = parseInt(this.attributes.score, 10)
  let currentQuestionIndex = parseInt(this.attributes.currentQuestionIndex, 10)
  const correctAnswerText = this.attributes.correctAnswerText
  const translatedQuestions = this.t('QUESTIONS', {
    keySeparator: '#'
  })
  // keySeparator hash necessary do not remove

  if (answerSlotValid && parseInt(this.event.request.intent.slots.Answer.value, 10) === this.attributes['correctAnswerIndex']) {
    currentScore++
    speechOutputAnalysis = this.t('ANSWER_CORRECT_MESSAGE')
  } else {
    // making adjustments to allow for invalid answers and option to repeat questions
    if (!userGaveUp && answerSlotValid && parseInt(this.event.request.intent.slots.Answer.value, 10) > 0 || !userGaveUp && answerSlotValid && parseInt(this.event.request.intent.slots.Answer.value, 10) < 5) {
      speechOutputAnalysis = this.t('ANSWER_WRONG_MESSAGE')
    }
    if (parseInt(this.event.request.intent.slots.Answer.value, 10) < 5 && parseInt(this.event.request.intent.slots.Answer.value, 10) > 0) {
      speechOutputAnalysis += this.t('CORRECT_ANSWER_MESSAGE', correctAnswerIndex, correctAnswerText)
    }
    if (parseInt(this.event.request.intent.slots.Answer.value, 10) > 4 || parseInt(this.event.request.intent.slots.Answer.value, 10) < 1 ||
			isNaN(parseInt(this.event.request.intent.slots.Answer.value, 10))) {
      speechOutputAnalysis = this.emit(':ask', this.t('TRIVIA_UNHANDLED') + ' ' + ' ' + this.t('REPEAT_QUESTION_MESSAGE'))
    }
  }

  // Check if we can exit the game session after GAME_LENGTH questions (zero-indexed)
  if (this.attributes['currentQuestionIndex'] === GAME_LENGTH - 1) {
    speechOutput = userGaveUp ? '' : this.t('ANSWER_IS_MESSAGE')
    if (currentScore === 10) {
      speechOutput += speechOutputAnalysis + this.t('GAME_OVER_MESSAGE1010', currentScore.toString(), GAME_LENGTH.toString())
    } else {
      speechOutput += speechOutputAnalysis + this.t('GAME_OVER_MESSAGE', currentScore.toString(), GAME_LENGTH.toString())
    }
    this.response.speak(speechOutput)
    this.emit(':responseReady')
  } else {
    currentQuestionIndex += 1
    correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT))
    const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]
    const roundAnswers = populateRoundAnswers.call(this, gameQuestions, currentQuestionIndex, correctAnswerIndex, translatedQuestions)
    const questionIndexForSpeech = currentQuestionIndex + 1
    let repromptText = this.t('TELL_QUESTION_MESSAGE', questionIndexForSpeech.toString(), spokenQuestion)

    for (let i = 0; i < ANSWER_COUNT; i++) {
      repromptText += `${i + 1}. ${roundAnswers[i]}. `
    }

    speechOutput += userGaveUp ? '' : this.t('ANSWER_IS_MESSAGE')
    speechOutput += speechOutputAnalysis + this.t('SCORE_IS_MESSAGE', currentScore.toString()) + repromptText

    Object.assign(this.attributes, {
      'speechOutput': repromptText,
      'repromptText': repromptText,
      'currentQuestionIndex': currentQuestionIndex,
      'correctAnswerIndex': correctAnswerIndex + 1,
      'questions': gameQuestions,
      'score': currentScore,
      'correctAnswerText': translatedQuestions[gameQuestions[currentQuestionIndex]][Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]][0]
    })

    this.response.speak(speechOutput).listen(repromptText)
    this.response.cardRenderer(this.t('GAME_NAME'), repromptText)
    this.emit(':responseReady')
  }
}

function handleUserSubject () {
  const choiceArr = [
    'JavaScript'.toLocaleLowerCase(),
    'C s s'.toLocaleLowerCase(),
    'General and networking'.toLocaleLowerCase(),
    'Random topics'.toLocaleLowerCase()

  ]

  const chosenSubject = parseInt(this.event.request.intent.slots.Answer.value)
  const chosenSubjectString = (choiceArr[chosenSubject - 1]) !== undefined ? choiceArr[chosenSubject - 1] : 'Random topics'

  // insert choice into welcome string
  languageString['en']['translation']['WELCOME_MESSAGE'] = 'I will ask you %s questions on, ' + chosenSubjectString + ', try to score as highly as possible. ' +
		'Just say the number of the answer. Here we go!. '

  switch (chosenSubject) {
    case (1):
      languageString['en']['translation']['QUESTIONS'] = javascriptquestions['QUESTIONS_EN_US']
      languageString['en-US']['translation']['QUESTIONS'] = javascriptquestions['QUESTIONS_EN_US']

      break
    case (2):
      languageString['en']['translation']['QUESTIONS'] = cssquestions['QUESTIONS_EN_US']
      languageString['en-US']['translation']['QUESTIONS'] = cssquestions['QUESTIONS_EN_US']

      break

    case (3):
      languageString['en']['translation']['QUESTIONS'] = generalquestions['QUESTIONS_EN_US']
      languageString['en-US']['translation']['QUESTIONS'] = generalquestions['QUESTIONS_EN_US']

      break

    case (4):
      languageString['en']['translation']['QUESTIONS'] = randomquestions['QUESTIONS_EN_US']
      languageString['en-US']['translation']['QUESTIONS'] = randomquestions['QUESTIONS_EN_US']

      break
  }

  this.handler.state = GAME_STATES.START
  this.emitWithState('StartGame', true)
}

const setupStateHandlers = Alexa.CreateStateHandler(GAME_STATES.SETUP, {
  'SetUp': function () {
    temp = 0

    this.emit(':ask', 'Welcome to Free Code Camp Developer Quiz. Choose the subject you would like to test on. Just say One, for JavaScript ,two, for C s s ,three, for General programming and networking, or four, for random mode. The default, is Random mode', 'Choose the subject you would like to test on. Just say One, for JavaScript ,two, for C s s ,three, for General programming and networking, or four, for random mode. The default, is Random mode')
  },
  'AnswerIntent': function () {
    handleUserSubject.call(this, false)
  },

  // added help handlers
  'DontKnowIntent': function () {
    handleUserGuess.call(this, true)
  },
  'AMAZON.StartOverIntent': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.RepeatIntent': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.HelpIntent': function () {
    this.handler.state = GAME_STATES.HELP
    this.emitWithState('helpTheUser', false)
  },
  'AMAZON.StopIntent': function () {
    this.handler.state = GAME_STATES.HELP
    const speechOutput = this.t('STOP_MESSAGE')
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'AMAZON.CancelIntent': function () {
    this.response.speak(this.t('CANCEL_MESSAGE'))
    this.emit(':responseReady')
  },
  'Unhandled': function () {
    const speechOutput = this.t('TRIVIA_UNHANDLED', ANSWER_COUNT.toString())
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'SessionEndedRequest': function () {
    console.log(`Session ended in trivia state: ${this.event.request.reason}`)
  }
})

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
  'StartGame': function (newGame) {
    let speechOutput = newGame ? this.t('NEW_GAME_MESSAGE', this.t('GAME_NAME')) + this.t('WELCOME_MESSAGE', GAME_LENGTH.toString()) : ''
    // Select GAME_LENGTH questions for the game
    const translatedQuestions = this.t('QUESTIONS', {
      keySeparator: '#'
    })
    const gameQuestions = populateGameQuestions(translatedQuestions)
    // Generate a random index for the correct answer, from 0 to 3
    const correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT))
    // Select and shuffle the answers for each question
    const roundAnswers = populateRoundAnswers(gameQuestions, 0, correctAnswerIndex, translatedQuestions)
    const currentQuestionIndex = 0
    const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]

    let repromptText = this.t('TELL_QUESTION_MESSAGE', '1', spokenQuestion)

    for (let i = 0; i < ANSWER_COUNT; i++) {
      repromptText += `${i + 1}. ${roundAnswers[i]}. `
    }

    speechOutput += repromptText

    Object.assign(this.attributes, {
      'speechOutput': repromptText,
      'repromptText': repromptText,
      'currentQuestionIndex': currentQuestionIndex,
      'correctAnswerIndex': correctAnswerIndex + 1,
      'questions': gameQuestions,
      'score': 0,
      'correctAnswerText': translatedQuestions[gameQuestions[currentQuestionIndex]][Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]][0]
    })

    // Set the current state to trivia mode. The skill will now use handlers defined in triviaStateHandlers
    this.handler.state = GAME_STATES.TRIVIA

    this.response.speak(speechOutput).listen(repromptText)
    this.response.cardRenderer(this.t('GAME_NAME'), repromptText)
    this.emit(':responseReady')
  }
})

const triviaStateHandlers = Alexa.CreateStateHandler(GAME_STATES.TRIVIA, {
  'AnswerIntent': function () {
    handleUserGuess.call(this, false)
  },

  'DontKnowIntent': function () {
    handleUserGuess.call(this, true)
  },
  'AMAZON.StartOverIntent': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.RepeatIntent': function () {
    this.response.speak(this.attributes['speechOutput']).listen(this.attributes['repromptText'])
    this.emit(':responseReady')
  },
  'AMAZON.HelpIntent': function () {
    this.handler.state = GAME_STATES.HELP
    this.emitWithState('helpTheUser', false)
  },
  'AMAZON.StopIntent': function () {
    this.handler.state = GAME_STATES.HELP
    const speechOutput = this.t('STOP_MESSAGE')
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'AMAZON.CancelIntent': function () {
    this.response.speak(this.t('CANCEL_MESSAGE'))
    this.emit(':responseReady')
  },
  'Unhandled': function () {
    const speechOutput = this.t('TRIVIA_UNHANDLED', ANSWER_COUNT.toString())
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'SessionEndedRequest': function () {
    console.log(`Session ended in trivia state: ${this.event.request.reason}`)
  }
})

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
  'helpTheUser': function (newGame) {
    const askMessage = newGame ? this.t('ASK_MESSAGE_START') : this.t('REPEAT_QUESTION_MESSAGE') + this.t('STOP_MESSAGE')
    const speechOutput = this.t('HELP_MESSAGE', GAME_LENGTH) + askMessage
    const repromptText = this.t('HELP_REPROMPT') + askMessage

    this.response.speak(speechOutput).listen(repromptText)
    this.emit(':responseReady')
  },
  'AMAZON.StartOverIntent': function () {
    this.handler.state = GAME_STATES.SETUP
    this.emitWithState('SetUp', true)
  },
  'AMAZON.RepeatIntent': function () {
    const newGame = !(this.attributes['speechOutput'] && this.attributes['repromptText'])
    this.emitWithState('helpTheUser', newGame)
  },
  'AMAZON.HelpIntent': function () {
    const newGame = !(this.attributes['speechOutput'] && this.attributes['repromptText'])
    this.emitWithState('helpTheUser', newGame)
  },
  'AMAZON.YesIntent': function () {
    if (this.attributes['speechOutput'] && this.attributes['repromptText'] && temp > 0) {
      this.handler.state = GAME_STATES.TRIVIA
      this.emitWithState('AMAZON.RepeatIntent')
    } else {
      this.handler.state = GAME_STATES.SETUP
      this.emitWithState('SetUp', true)
    }
  },
  'AMAZON.NoIntent': function () {
    const speechOutput = this.t('NO_MESSAGE')
    this.response.speak(speechOutput)
    this.emit(':responseReady')
  },
  'AMAZON.StopIntent': function () {
    const speechOutput = this.t('STOP_MESSAGE')
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'AMAZON.CancelIntent': function () {
    this.response.speak(this.t('CANCEL_MESSAGE'))
    this.emit(':responseReady')
  },
  'Unhandled': function () {
    const speechOutput = this.t('HELP_UNHANDLED')
    this.response.speak(speechOutput).listen(speechOutput)
    this.emit(':responseReady')
  },
  'SessionEndedRequest': function () {
    console.log(`Session ended in help state: ${this.event.request.reason}`)
  }
})

exports.handler = function (event, context) {
  const alexa = Alexa.handler(event, context)
  alexa.appId = APP_ID
  // To enable string internationalization (i18n) features, set a resources object.
  alexa.resources = languageString
  alexa.registerHandlers(newSessionHandlers, setupStateHandlers, startStateHandlers, triviaStateHandlers, helpStateHandlers)
  alexa.execute()
}
