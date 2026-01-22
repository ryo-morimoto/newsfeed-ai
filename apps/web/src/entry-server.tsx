import 'virtual:uno.css'
import './styles/base.css'
import './styles/animations.css'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

export default createStartHandler(defaultStreamHandler)
