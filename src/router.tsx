import { createBrowserRouter } from 'react-router'
import { Layout } from './components/layout/Layout'
import { BagPage } from './pages/BagPage'
import { Catalog } from './pages/Catalog'
import { Checkout } from './pages/Checkout'
import { Home } from './pages/Home'
import { About, Contact, FaqPage, HowItWorks, Terms } from './pages/InfoPages'
import { MyOrders } from './pages/MyOrders'
import { NotFound } from './pages/NotFound'
import { OrderPage } from './pages/OrderPage'
import { Product } from './pages/Product'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

// O painel da equipe carrega sob demanda: quem só aluga não baixa esse código.
const admin = () => import('./pages/admin/AdminPages')

export const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: Layout,
      children: [
        { index: true, Component: Home },
        { path: 'malas', Component: Catalog },
        { path: 'malas/:id', Component: Product },
        { path: 'reserva', Component: BagPage },
        { path: 'pagamento', Component: Checkout },
        { path: 'pedido/:code', Component: OrderPage },
        { path: 'minhas-reservas', Component: MyOrders },
        { path: 'como-funciona', Component: HowItWorks },
        { path: 'perguntas', Component: FaqPage },
        { path: 'termos', Component: Terms },
        { path: 'contato', Component: Contact },
        { path: 'sobre', Component: About },
        { path: '*', Component: NotFound },
      ],
    },
    {
      path: '/equipe',
      lazy: async () => ({ Component: (await import('./pages/admin/AdminLayout')).AdminLayout }),
      children: [
        { index: true, lazy: async () => ({ Component: (await admin()).AdminToday }) },
        { path: 'reservas', lazy: async () => ({ Component: (await admin()).AdminOrders }) },
        { path: 'estoque', lazy: async () => ({ Component: (await admin()).AdminStock }) },
        { path: 'numeros', lazy: async () => ({ Component: (await admin()).AdminNumbers }) },
      ],
    },
  ],
  { basename },
)
