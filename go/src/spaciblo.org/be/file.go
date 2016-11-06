package be

import (
	"errors"
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"
)

const (
	keySeparator             = "___"
	localFileStorageTempName = "t_e_m_p"
)

/*
FileStorage is the interface used by be.API to persist and retrieve files.

A derivate of "" indicates that this is the original file, otherwise it indicates a File derived from the original.
For example, a derivative of "fit-crop-200x200" of an image would be a fit-cropped version of maximum size 200x200.
The key is the same for the original file and its derivatives.

LocalFileStorage implements FileStorage and uses the local file system, but it should also be possible to create FileStorage backed by services like S3.
*/
type FileStorage interface {
	Put(name string, reader io.Reader) (key string, err error)
	PutDerivative(key string, derivative string, reader io.Reader) error
	Get(key string, derivative string) (File, error)
	Exists(key string, derivative string) (bool, error)
	Delete(key string, derivative string) error
}

/*
File is the type stored by FileStorage.  LocalFile is an example of File which uses the local file system.
*/
type File interface {
	Key() string

	// Derivative is "" for the original File and something like "thumbnail-100x100" for a derived File
	Derivative() string

	Name() (string, error)

	Exists() (bool, error)

	Size() (int64, error)

	Reader() (io.Reader, error)
}

/*
LocalFileStorage is a FileStorage persisted by the local file system
*/
type LocalFileStorage struct {
	RootDir string
}

/*
NewLocalFileStorage requires the rootDir exist and be a directory
*/
func NewLocalFileStorage(rootDir string) (*LocalFileStorage, error) {
	stat, err := os.Stat(rootDir)
	if err != nil {
		return nil, err
	}
	if !stat.IsDir() {
		return nil, os.ErrNotExist
	}
	fs := &LocalFileStorage{
		RootDir: rootDir,
	}
	return fs, nil
}

/*
Put stores the data from reader and returns its key. It does this by reading data into a temp file and then moving the file into place
*/
func (fs LocalFileStorage) Put(name string, reader io.Reader) (key string, err error) {
	key = fs.generateKey(name)
	err = fs.put(key, "", reader)
	if err != nil {
		return "", err
	}
	return key, nil
}

func (fs LocalFileStorage) PutDerivative(key string, derivative string, reader io.Reader) error {
	exists, err := fs.Exists(key, "")
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("Cannot create a derivative for a non-existant key")
	}
	return fs.put(key, derivative, reader)
}

/*
Put stores the data from reader and returns its key. It does this by reading data into a temp file and then moving the file into place
*/
func (fs LocalFileStorage) put(key string, derivative string, reader io.Reader) (err error) {
	derivativeDir, err := fs.derivativeDir(derivative)
	if err != nil {
		return err
	}
	// Create the temp file with the data from reader
	tempDir, err := fs.getOrCreateTempDir()
	if err != nil {
		return err
	}
	tempFile, err := ioutil.TempFile(tempDir, "lfs")
	if err != nil {
		return err
	}
	_, err = io.Copy(tempFile, reader)
	tempFile.Close()
	if err != nil {
		return err
	}
	// the temp file contains the data, now move it into place
	err = os.Rename(tempFile.Name(), path.Join(derivativeDir, key))
	if err != nil {
		os.Remove(tempFile.Name()) // Best try to remove the temp file since the copy failed
		return err
	}
	return nil
}

func (fs LocalFileStorage) Get(key string, derivative string) (File, error) {
	derivativeDir, err := fs.derivativeDir(derivative)
	if err != nil {
		return nil, err
	}
	lf := LocalFile{
		key:        fs.clean(key),
		derivative: derivative,
		dir:        derivativeDir,
	}
	exists, err := lf.Exists()
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("No such File: " + lf.key + " with derivative: " + derivative)
	}
	return lf, nil
}

func (fs LocalFileStorage) Exists(key string, derivative string) (bool, error) {
	key = fs.clean(key)
	if key == "" {
		return false, errors.New("Empty file key")
	}
	derivativeDir, err := fs.derivativeDir(derivative)
	if err != nil {
		return false, err
	}
	lf := LocalFile{
		key:        key,
		derivative: derivative,
		dir:        derivativeDir,
	}
	return lf.Exists()
}

/*
Delete returns an error only if the file exists and there is a problem deleting it.
If it doesn't exist or there is no problem deleting the file then Delete returns nil.
*/
func (fs LocalFileStorage) Delete(key string, derivative string) error {
	derivativeDir, err := fs.derivativeDir(derivative)
	if err != nil {
		return err
	}
	lf := LocalFile{
		key:        key,
		derivative: derivative,
		dir:        derivativeDir,
	}
	exists, err := lf.Exists()
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	if derivative == "" {
		// This is the original, delete all of the derivatives
		dirPaths := fs.derivativeDirPaths()
		for _, deriv := range dirPaths {
			ddir, _ := fs.derivativeDir(deriv)
			df := LocalFile{
				key:        key,
				derivative: deriv,
				dir:        ddir,
			}
			df.delete()
		}
	}
	return lf.delete()
}

func (fs LocalFileStorage) derivativeDirPaths() []string {
	rf, _ := os.Open(fs.RootDir)
	results := []string{}
	dirs, _ := rf.Readdir(-1)
	for _, dir := range dirs {
		if dir.IsDir() && dir.Name() != localFileStorageTempName {
			results = append(results, dir.Name())
		}
	}
	return results
}

func (fs LocalFileStorage) derivativeDir(derivative string) (dirPath string, err error) {
	if derivative == "" {
		return fs.RootDir, nil
	}
	dirPath = path.Join(fs.RootDir, fs.clean(derivative))
	stat, err := os.Stat(dirPath)
	if err != nil {
		err = os.Mkdir(dirPath, os.ModeSticky|0775)
		if err != nil {
			return "", errors.New("Could not create the derivative dir: " + derivative)
		}
	} else if !stat.IsDir() {
		return "", errors.New("derivative conflicts with an existing file: " + derivative)
	}
	return dirPath, nil
}

// getOrCreateTempDir locates and creates if necessary the dir where files are staged
// we don't use os.TempDir() because it uses /tmp which is not on the same mount as FILE_STORAGE_DIR so would cause os.Rename to fail
func (fs LocalFileStorage) getOrCreateTempDir() (dpath string, err error) {
	dpath = path.Join(fs.RootDir, localFileStorageTempName)
	stat, err := os.Stat(dpath)
	if err == nil {
		if !stat.IsDir() {
			return "", errors.New(dpath + " exists but is not a directory")
		}
		return dpath, nil
	}
	// Doesn't exist, try to create it
	err = os.Mkdir(dpath, os.ModeSticky|0775)
	if err != nil {
		return "", err
	}
	return dpath, nil
}

// clean removes any characters which may cause trouble in FS names
func (fs LocalFileStorage) clean(token string) string {
	token = strings.Replace(token, "/", "-", -1)
	token = strings.Replace(token, "..", "-", -1)
	token = strings.Replace(token, "...", "-", -1)
	token = strings.Replace(token, " ", "-", -1)
	token = strings.Replace(token, "<", "-", -1)
	token = strings.Replace(token, ">", "-", -1)
	token = strings.Replace(token, "@", "-", -1)
	return token
}

// generateKey returns a FS friendly name which is highly likely to be unique
func (fs LocalFileStorage) generateKey(name string) string {
	slashIndex := strings.Index(name, "/")
	if slashIndex != -1 {
		name = strings.Split(name, "/")[0]
	}
	return UUID() + keySeparator + fs.clean(name)
}

/*
LocalFile is a be.File backed by a LocalFileStorage
*/
type LocalFile struct {
	key        string
	derivative string
	dir        string
}

func (lf LocalFile) Key() string {
	return lf.key
}

func (lf LocalFile) Derivative() string {
	return lf.derivative
}

/*
Name is derived from Key which is <UUID><keySeparator><name>
*/
func (lf LocalFile) Name() (string, error) {
	return lf.key[strings.Index(lf.key, keySeparator)+len(keySeparator):], nil
}

/*
Exists for a LocalFile never returns an error, but other FileStorage implementations might
*/
func (lf LocalFile) Exists() (bool, error) {
	_, err := os.Stat(lf.path())
	return err == nil, nil
}

func (lf LocalFile) Size() (int64, error) {
	stat, err := os.Stat(lf.path())
	if err != nil {
		return -1, err
	}
	return stat.Size(), nil
}

func (lf LocalFile) Reader() (io.Reader, error) {
	return os.OpenFile(lf.path(), os.O_RDONLY, os.ModePerm)
}

func (lf LocalFile) delete() error {
	return os.Remove(lf.path())
}

// path returns the full path using the dir
func (lf LocalFile) path() string {
	return path.Join(lf.dir, lf.key)
}
