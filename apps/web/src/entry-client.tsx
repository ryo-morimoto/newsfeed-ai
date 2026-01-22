import 'virtual:uno.css'
import './styles/base.css'
import './styles/animations.css'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

hydrateRoot(document, <StartClient />)
