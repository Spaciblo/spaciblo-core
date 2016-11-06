package be

import (
	"errors"
	"net"
	"sync"
	"time"
)

// StoppableListener taken from https://github.com/hydrogen18/stoppableListener
type StoppableListener struct {
	*net.TCPListener          //Wrapped listener
	stop             chan int //Channel used only to indicate listener should shutdown
	wg               sync.WaitGroup
}

func NewStoppableListener(proto string, connect string) (*StoppableListener, error) {
	l, err := net.Listen(proto, connect)
	if err != nil {
		return nil, err
	}
	tcpL, ok := l.(*net.TCPListener)
	if !ok {
		return nil, errors.New("Cannot wrap listener")
	}
	retval := &StoppableListener{}
	retval.TCPListener = tcpL
	retval.stop = make(chan int)
	return retval, nil
}

var ErrStopped = errors.New("Listener stopped")

func (sl *StoppableListener) Accept() (net.Conn, error) {
	for {
		//Wait up to one second for a new connection
		sl.SetDeadline(time.Now().Add(time.Second))
		newConn, err := sl.TCPListener.Accept()

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
