package be

import (
	"testing"

	. "github.com/chai2010/assert"
)

func TestMimeType(t *testing.T) {
	AssertEqual(t, "image/jpeg", MimeTypeFromFileName("foo.jpg"))
	AssertEqual(t, "image/gif", MimeTypeFromFileName("flowers/foo.gif"))
	AssertEqual(t, "image/png", MimeTypeFromFileName("moo.png"))
	AssertEqual(t, "", MimeTypeFromFileName(""))
	AssertEqual(t, "", MimeTypeFromFileName("Moo"))
}
