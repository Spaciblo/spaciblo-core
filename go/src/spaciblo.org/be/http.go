package be

import (
	"crypto/tls"
	"errors"
	"net"
	"sync"
	"time"
)

// StoppableListener taken from https://github.com/hydrogen18/stoppableListener
type StoppableListener struct {
	net.Listener                  //inner, TLS listener
	tcpListener  *net.TCPListener // TCPlistener
	stop         chan int         //Channel used only to indicate listener should shutdown
	waitGroup    sync.WaitGroup
}

func NewStoppableListener(connect string, certPath string, keyPath string) (*StoppableListener, error) {
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		logger.Println("Error loading cert", err)
		return nil, err
	}
	config := &tls.Config{Certificates: []tls.Certificate{cert}}

	netListener, err := net.Listen("tcp", connect)
	if err != nil {
		return nil, err
	}
	tcpListener, ok := netListener.(*net.TCPListener)
	if !ok {
		return nil, errors.New("Cannot wrap listener")
	}
	tlsListener := tls.NewListener(tcpListener, config)

	stoppableListener := &StoppableListener{}
	stoppableListener.Listener = tlsListener
	stoppableListener.tcpListener = tcpListener
	stoppableListener.stop = make(chan int)
	return stoppableListener, nil
}

var ErrStopped = errors.New("Listener stopped")

func (sl *StoppableListener) Accept() (net.Conn, error) {
	for {
		//Wait up to one second for a new connection
		sl.tcpListener.SetDeadline(time.Now().Add(time.Second))
		newConn, err := sl.Listener.Accept()

		//Check for the channel being closed
		select {
		case <-sl.stop:
			return nil, ErrStopped
		default:
			//If the channel is still open, continue as normal
		}

		if err != nil {
			netErr, ok := err.(net.Error)
			//If this is a timeout, then continue to wait for
			//new connections
			if ok && netErr.Timeout() && netErr.Temporary() {
				continue
			}
		}
		return newConn, err
	}
}

func (sl *StoppableListener) Stop() {
	close(sl.stop)
}
