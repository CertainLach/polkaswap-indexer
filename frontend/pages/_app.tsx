import '../styles/globals.css'
import { ApolloProvider } from "@apollo/react-hooks";
import withApollo from '../config/apollo';

function MyApp({ Component, pageProps, apollo }: any) {
  return <ApolloProvider client={apollo}>
    <Component {...pageProps} />
  </ApolloProvider>
}

export default withApollo(MyApp)
