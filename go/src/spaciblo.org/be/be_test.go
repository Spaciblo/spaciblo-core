package be

import (
	"flag"
	"os"
	"testing"

	. "github.com/chai2010/assert"
)

var (
	CWD = flag.String("cwd", "", "set cwd") // Sets the current working directory because otherwise the testing CWD is wherever go test puts the test binary
)

func init() {
	flag.Parse()
	if *CWD != "" {
		if err := os.Chdir(*CWD); err != nil {
			logger.Println("Chdir error", err)
		}
	}
}

func TestMimeType(t *testing.T) {
	AssertEqual(t, "image/jpeg", MimeTypeFromFileName("foo.jpg"))
	AssertEqual(t, "image/gif", MimeTypeFromFileName("flowers/foo.gif"))
	AssertEqual(t, "image/png", MimeTypeFromFileName("moo.png"))
	AssertEqual(t, "", MimeTypeFromFileName(""))
	AssertEqual(t, "", MimeTypeFromFileName("Moo"))
}
